"""
pixhawk_bridge.py — AERO-LINK GCS Pixhawk 2.4.8 (433MHz Telemetry Radio Bridge)
Komunikasi dua arah antara Pixhawk (ArduPilot MAVLink) dan FastAPI Backend / Web GCS.

Usage:
    python drone/pixhawk_bridge.py --port COM8 --baud 57600
"""

import time
import math
import argparse
import sys
import threading
import json
import asyncio
import requests
import websockets
from pymavlink import mavutil

# --- DEFAULT CONFIG ---
DEFAULT_PORT = "COM8"
DEFAULT_BAUD = 57600
DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"
USERNAME = "admin"
PASSWORD = "admin123"
DRONE_ID = 1

# Shared state
shared_context = {
    "token": "",
    "headers": {},
    "backend_url": DEFAULT_BACKEND_URL,
    "running": True,
    "armed": False,
    "flight_mode": "STABILIZE"
}

# Queue untuk mengirim event log ke frontend lewat WebSocket
ws_outgoing_queue = []
ws_queue_lock = threading.Lock()

def queue_web_log(text, log_type="info", drone_state=None):
    with ws_queue_lock:
        ws_outgoing_queue.append({
            "event": "event_log",
            "data": {
                "text": text,
                "type": log_type,
                "drone_state": drone_state
            }
        })

telemetry_data = {
    "drone_id": DRONE_ID,
    "latitude": 0.0,
    "longitude": 0.0,
    "altitude": 0.0,
    "roll": 0.0,
    "pitch": 0.0,
    "yaw": 0.0,
    "battery": 100.0,
    "speed": 0.0,
    "rssi": -50,
    "snr": 20.0
}

def get_jwt_token(backend_url):
    try:
        res = requests.post(
            f"{backend_url}/api/v1/auth/login",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=3.0
        )
        if res.status_code == 200:
            return res.json().get("access_token")
    except Exception:
        pass
    return None

def refresh_token():
    token = get_jwt_token(shared_context["backend_url"])
    if token:
        shared_context["token"] = token
        shared_context["headers"] = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        return True
    return False

def request_message_streams(master):
    """Minta Pixhawk stream semua data telemetri secara berkelanjutan."""
    try:
        # Request stream umum (Attitude, Position, VFR HUD, System Status)
        streams = [
            (mavutil.mavlink.MAV_DATA_STREAM_EXTRA1, 20),  # Attitude 20Hz
            (mavutil.mavlink.MAV_DATA_STREAM_POSITION, 10), # Lat, Lon, Alt 10Hz
            (mavutil.mavlink.MAV_DATA_STREAM_EXTRA2, 10),  # VFR_HUD (speed, throttle)
            (mavutil.mavlink.MAV_DATA_STREAM_EXTENDED_STATUS, 2), # Sys Status, Battery
            (mavutil.mavlink.MAV_DATA_STREAM_RAW_CONTROLLER, 2),
        ]
        for stream_id, rate in streams:
            master.mav.request_data_stream_send(
                master.target_system,
                master.target_component,
                stream_id,
                rate,
                1
            )
        print("[+] Request data stream terkirim ke Pixhawk.")
    except Exception as e:
        print(f"[!] Gagal request data stream: {e}")

def set_arducopter_mode(master, mode_name):
    """Ganti flight mode ArduCopter (STABILIZE, ALT_HOLD, LOITER, LAND, RTL, dll)."""
    mode_map = master.mode_mapping()
    if not mode_map or mode_name not in mode_map:
        print(f"[!] Mode {mode_name} tidak ditemukan dalam mapping mode ArduCopter.")
        return
    mode_id = mode_map[mode_name]
    master.mav.set_mode_send(
        master.target_system,
        mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
        mode_id
    )
    print(f"[+] Flight mode diubah ke: {mode_name} (ID: {mode_id})")

def set_pixhawk_param(master, param_name: str, param_value: float, param_type=mavutil.mavlink.MAV_PARAM_TYPE_INT8):
    """Ubah parameter di Pixhawk via MAVLink."""
    try:
        master.mav.param_set_send(
            master.target_system,
            master.target_component,
            param_name.encode('utf-8'),
            param_value,
            param_type
        )
        print(f"[+] Parameter Pixhawk di-set: {param_name} = {param_value}")
    except Exception as e:
        print(f"[!] Gagal set parameter {param_name}: {e}")

def calibrate_gyro(master):
    """Trigger kalibrasi Gyroscope Pixhawk (drone harus diam & rata)."""
    master.mav.command_long_send(
        master.target_system,
        master.target_component,
        mavutil.mavlink.MAV_CMD_PREFLIGHT_CALIBRATION,
        0,
        1,  # param1: 1 = gyro calibration
        0,  # param2: magnetometer
        0,  # param3: ground pressure (baro)
        0,  # param4: radio
        0,  # param5: accel
        0, 0
    )
    print("[+] Kalibrasi Gyroscope dikirim ke Pixhawk (pastikan drone diam)...")
    queue_web_log("[GCS] Triggered Gyro & Baro Calibration on Pixhawk (keep UAV still)...", "system")

def arm_disarm(master, arm: bool, force: bool = True):
    """Kirim perintah ARM (1) atau DISARM (0) ke Pixhawk.
    Di ArduPilot, param2 = 21196 adalah magic code untuk Force Arm / Force Disarm dari GCS.
    """
    magic_force = 21196 if force else 0
    master.mav.command_long_send(
        master.target_system,
        master.target_component,
        mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
        0,
        1 if arm else 0,
        magic_force,
        0, 0, 0, 0, 0
    )
    print(f"[+] Command {'ARM (Force=21196)' if arm else 'DISARM'} dikirim ke Pixhawk.")

def execute_command(master, cmd):
    cmd = cmd.strip().upper()
    print(f"\n[COMMAND DARI GCS]: >>> {cmd} <<<")
    if cmd == "ARM":
        arm_disarm(master, True)
    elif cmd == "DISARM":
        arm_disarm(master, False)
    elif cmd in ("CALIBRATE", "CALIBRATE_GYRO"):
        calibrate_gyro(master)
    elif cmd == "TAKEOFF":
        # ArduCopter takeoff command: set mode GUIDED/ALT_HOLD lalu kirim takeoff altitude 2.0 meter
        set_arducopter_mode(master, "GUIDED")
        master.mav.command_long_send(
            master.target_system,
            master.target_component,
            mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
            0,
            0, 0, 0, 0, 0, 0,
            2.0  # Takeoff altitude 2 meter
        )
        print("[+] Command NAV_TAKEOFF (2m) dikirim.")
    elif cmd == "LAND":
        set_arducopter_mode(master, "LAND")
    elif cmd in ("RTL", "RTH"):
        set_arducopter_mode(master, "RTL")
    elif cmd in ("STABILIZE", "LOITER", "ALT_HOLD", "AUTO", "POSHOLD"):
        set_arducopter_mode(master, cmd)
    else:
        print(f"[!] Command tidak dikenal: {cmd}")

async def websocket_command_task(master, backend_url):
    ws_url = backend_url.replace("http://", "ws://") + "/ws/telemetry"
    while shared_context["running"]:
        try:
            print(f"[WS] Menghubungkan ke backend command channel: {ws_url}...")
            async with websockets.connect(ws_url) as ws:
                print("[WS] Terhubung! Siap menerima tombol kontrol dari Web GCS.")
                queue_web_log("Pixhawk 2.4.8 (433MHz Telemetry) connected to GCS.", "system", "ARMED" if shared_context["armed"] else "DISARMED")

                async def sender_loop():
                    while shared_context["running"]:
                        items = []
                        with ws_queue_lock:
                            if ws_outgoing_queue:
                                items = list(ws_outgoing_queue)
                                ws_outgoing_queue.clear()
                        for item in items:
                            await ws.send(json.dumps(item))
                        await asyncio.sleep(0.05)

                sender_task = asyncio.create_task(sender_loop())
                try:
                    async for message in ws:
                        if not shared_context["running"]:
                            break
                        try:
                            msg = json.loads(message)
                            if msg.get("event") == "command":
                                cmd_data = msg.get("data", {})
                                cmd = cmd_data.get("command")
                                if cmd:
                                    execute_command(master, cmd)
                        except Exception as e:
                            print(f"[WS] Error parsing: {e}")
                finally:
                    sender_task.cancel()
        except Exception:
            if shared_context["running"]:
                await asyncio.sleep(2.0)

def mavlink_reader_thread(master):
    """Membaca paket MAVLink dari Telemetry 433MHz."""
    print("[+] MAVLink reader thread aktif. Membaca telemetri dari Pixhawk...")
    last_disp = 0
    http_session = requests.Session()

    while shared_context["running"]:
        try:
            msg = master.recv_match(blocking=True, timeout=0.5)
            if not msg:
                continue

            msg_type = msg.get_type()

            if msg_type == 'HEARTBEAT':
                if msg.autopilot == mavutil.mavlink.MAV_AUTOPILOT_INVALID:
                    continue
                # Status armed / disarmed
                is_armed = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
                if is_armed != shared_context["armed"]:
                    shared_context["armed"] = is_armed
                    state_str = "ARMED" if is_armed else "DISARMED"
                    queue_web_log(
                        f"[PIXHAWK] Motor State Changed -> {state_str}",
                        "info" if is_armed else "warn",
                        state_str
                    )
                # Custom flight mode name
                mode_map = master.mode_mapping()
                if mode_map:
                    for name, mid in mode_map.items():
                        if mid == msg.custom_mode:
                            if name != shared_context["flight_mode"]:
                                shared_context["flight_mode"] = name
                                queue_web_log(f"[PIXHAWK] Flight Mode -> {name}", "system")
                            break

            elif msg_type == 'ATTITUDE':
                # Convert radians ke derajat
                telemetry_data["roll"] = round(math.degrees(msg.roll), 1)
                telemetry_data["pitch"] = round(math.degrees(msg.pitch), 1)
                telemetry_data["yaw"] = round(math.degrees(msg.yaw), 1)

            elif msg_type == 'GLOBAL_POSITION_INT':
                telemetry_data["latitude"] = round(msg.lat / 1e7, 6)
                telemetry_data["longitude"] = round(msg.lon / 1e7, 6)
                telemetry_data["altitude"] = round(msg.relative_alt / 1000.0, 2)  # mm ke meter

            elif msg_type == 'VFR_HUD':
                telemetry_data["speed"] = round(msg.groundspeed, 1)
                # Jika altitude GPS belum valid, pakai barometric altitude dari VFR_HUD
                if telemetry_data["altitude"] == 0.0:
                    telemetry_data["altitude"] = round(msg.alt, 2)

            elif msg_type == 'SYS_STATUS':
                if msg.battery_remaining != -1:
                    telemetry_data["battery"] = float(msg.battery_remaining)

            elif msg_type == 'RADIO_STATUS':
                # RSSI & SNR asli dari modul 433MHz SiK Radio
                # rssi (0-255), noise (0-255), remrssi, remnoise
                raw_rssi = msg.rssi
                # Estimasi dBm: (raw / 1.9) - 127
                telemetry_data["rssi"] = int((raw_rssi / 1.9) - 127)
                noise = msg.noise
                telemetry_data["snr"] = round(float(raw_rssi - noise), 1)

            elif msg_type == 'COMMAND_ACK':
                ack_map = {
                    0: "ACCEPTED (Berhasil!)",
                    1: "TEMPORARILY_REJECTED (Ditolak Sementara)",
                    2: "DENIED (Ditolak!)",
                    3: "UNSUPPORTED (Tidak Didukung)",
                    4: "FAILED (Gagal! Cek pesan PreArm)",
                    5: "IN_PROGRESS (Sedang Diproses)",
                    6: "CANCELLED (Dibatalkan)"
                }
                cmd_names = {
                    400: "ARM/DISARM",
                    22: "TAKEOFF",
                    21: "LAND",
                    20: "RTL",
                    176: "SET_MODE"
                }
                cmd_label = cmd_names.get(msg.command, f"CMD_{msg.command}")
                res_str = ack_map.get(msg.result, f"RESULT_{msg.result}")
                print(f"\n[PIXHAWK ACK] {cmd_label} ({msg.command}) -> {res_str}")
                log_type = "info" if msg.result == 0 else "warn"
                state_str = "ARMED" if shared_context["armed"] else "DISARMED"
                queue_web_log(f"[PIXHAWK ACK] {cmd_label} -> {res_str}", log_type, state_str)

            elif msg_type == 'STATUSTEXT':
                text = msg.text.strip() if isinstance(msg.text, str) else msg.text.decode('utf-8', errors='ignore').strip()
                if text:
                    print(f"\n[PIXHAWK MSG] {text}")
                    is_warn = any(k in text.lower() for k in ("prearm", "failsafe", "disarm", "error", "fail", "bad", "not"))
                    state_str = "ARMED" if shared_context["armed"] else "DISARMED"
                    queue_web_log(f"[PIXHAWK] {text}", "warn" if is_warn else "system", state_str)
                    
                    # Auto trigger gyro calibration jika terdeteksi uncalibrated
                    if "gyros not calibrated" in text.lower() and not shared_context.get("gyro_calibrated"):
                        shared_context["gyro_calibrated"] = True
                        calibrate_gyro(master)

            # Display status ke console per 100ms
            now = time.time()
            if now - last_disp >= 0.1:
                arm_str = "ARMED" if shared_context["armed"] else "DISARMED"
                mode_str = shared_context["flight_mode"]
                print(
                    f"\r[{arm_str:8s}|{mode_str:9s}] "
                    f"R:{telemetry_data['roll']:5.1f}° P:{telemetry_data['pitch']:5.1f}° Y:{telemetry_data['yaw']:5.1f}° | "
                    f"Alt:{telemetry_data['altitude']:5.1f}m Spd:{telemetry_data['speed']:4.1f}m/s | "
                    f"Bat:{telemetry_data['battery']:3.0f}% | "
                    f"RSSI:{telemetry_data['rssi']}dBm SNR:{telemetry_data['snr']}dB  ",
                    end="", flush=True
                )
                last_disp = now

                # POST ke backend (auto-login / retry jika backend baru menyala)
                if not shared_context["token"]:
                    if int(now) % 5 == 0:  # Coba login ulang tiap 5 detik
                        refresh_token()
                if shared_context["token"]:
                    try:
                        res = http_session.post(
                            f"{shared_context['backend_url']}/api/v1/telemetry",
                            json=telemetry_data,
                            headers=shared_context["headers"],
                            timeout=0.1
                        )
                        if res.status_code == 401:
                            refresh_token()
                    except requests.exceptions.RequestException:
                        pass

        except Exception as e:
            if shared_context["running"]:
                time.sleep(0.01)

def main():
    parser = argparse.ArgumentParser(description="Aero-Link GCS - Pixhawk 433MHz Telemetry Bridge")
    parser.add_argument("--port", type=str, default=DEFAULT_PORT, help="COM port (default: COM8)")
    parser.add_argument("--baud", type=int, default=DEFAULT_BAUD, help="Baud rate (default: 57600)")
    parser.add_argument("--url", type=str, default=DEFAULT_BACKEND_URL, help="Backend URL (default: http://127.0.0.1:8000)")
    parser.add_argument("--disarm-delay", type=int, default=0, help="Auto disarm delay in seconds (0 = disabled, default: 0)")
    args = parser.parse_args()

    shared_context["backend_url"] = args.url

    print("=" * 68)
    print(f"  AERO-LINK GCS: Pixhawk 2.4.8 Telemetry Bridge (433MHz)")
    print(f"  Port: {args.port} | Baud: {args.baud} | Backend: {args.url}")
    print("=" * 68)

    # Auth backend
    if not refresh_token():
        print("[!] Backend FastAPI tidak terdeteksi atau login gagal. Bridge tetap berjalan membaca telemetri...")
    else:
        print("[+] Berhasil terotentikasi dengan backend FastAPI.")

    # Hubungkan ke Telemetry Radio 433MHz via MAVLink
    print(f"[~] Membuka port {args.port} @ {args.baud} baud...")
    try:
        master = mavutil.mavlink_connection(args.port, baud=args.baud)
    except Exception as e:
        print(f"[-] Gagal membuka port {args.port}: {e}")
        sys.exit(1)

    print("[~] Menunggu Heartbeat dari Pixhawk 2.4.8...")
    hb = master.wait_heartbeat(timeout=10)
    if not hb:
        print("[-] Timeout: Tidak menerima Heartbeat dari Pixhawk. Periksa kabel dan radio.")
        sys.exit(1)

    print(f"[+] Heartbeat terdeteksi! Autopilot Type: {hb.autopilot}, System: {master.target_system}")
    request_message_streams(master)
    set_pixhawk_param(master, "DISARM_DELAY", args.disarm_delay)

    # Thread pembaca MAVLink
    reader_thread = threading.Thread(target=mavlink_reader_thread, args=(master,), daemon=True)
    reader_thread.start()

    # Async task WebSocket untuk command di thread utama
    try:
        asyncio.run(websocket_command_task(master, args.url))
    except KeyboardInterrupt:
        print("\n[!] Bridge dihentikan oleh pengguna.")
    finally:
        shared_context["running"] = False
        master.close()
        print("[+] Port serial ditutup. Selesai.")

if __name__ == "__main__":
    main()
