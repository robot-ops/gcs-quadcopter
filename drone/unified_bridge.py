"""
unified_bridge.py — AERO-LINK GCS Unified Bridge
Menggabungkan inav_bridge.py + elrs_tx_bridge.py dalam satu script.

Usage:
    python drone/unified_bridge.py                        # auto-detect semua port
    python drone/unified_bridge.py COM8                   # ELRS TX di COM8
    python drone/unified_bridge.py COM8 400000            # ELRS TX di COM8 @ 400kbps
    python drone/unified_bridge.py COM8 400000 COM6       # ELRS + FC hybrid bench-test

Prioritas:
    - Jika ELRS TX terdeteksi  → kontrol CRSF nirkabel
    - Jika FC (COM6) terdeteksi → sync attitude via MSP
    - Keduanya bisa berjalan bersamaan (bench-test hybrid)
"""

import time
import struct
import requests
import serial
import serial.tools.list_ports
import sys
import threading
import asyncio
import json
import math
import websockets

# ── Config ──────────────────────────────────────────────────────────────────
BACKEND_URL     = "http://127.0.0.1:8000"
BACKEND_WS_URL  = "ws://127.0.0.1:8000/ws/telemetry"
USERNAME        = "admin"
PASSWORD        = "admin123"
DRONE_ID        = 1

DEFAULT_ELRS_PORT  = "COM8"
DEFAULT_ELRS_BAUD  = 115200
DEFAULT_FC_PORT    = "COM6"
DEFAULT_FC_BAUD    = 115200

# ── CRSF Constants ───────────────────────────────────────────────────────────
CRSF_ADDRESS_TX          = 0xEE
CRSF_ADDRESS_RADIO       = 0xEA
CRSF_SYNC                = 0xC8
CRSF_FRAMETYPE_ATTITUDE  = 0x1E
CRSF_FRAMETYPE_BATTERY   = 0x08
CRSF_FRAMETYPE_GPS       = 0x02
CRSF_FRAMETYPE_LINK_STATS= 0x14
CRSF_FRAMETYPE_RC_PACKED = 0x16
CRSF_FRAMETYPE_HANDSET   = 0x21
CRSF_FRAMETYPE_DEVICE_PING = 0x28
CRSF_FRAMETYPE_DEVICE_INFO = 0x29
CRSF_FRAMETYPE_PARAM_READ  = 0x2C
CRSF_FRAMETYPE_PARAM_WRITE = 0x2D
VALID_CRSF_ADDRESSES     = (0x00, 0xC8, 0xEA, 0xEC, 0xEE, 0xEF, 0x18)

MSP_ATTITUDE = 108
HEADER_MSP   = bytes([0x24, 0x4D, 0x3E])

# ── CRC ─────────────────────────────────────────────────────────────────────
def crc8_dvb_s2(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = ((crc << 1) ^ 0xD5) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc

# ── CRSF Frame Packer ────────────────────────────────────────────────────────
def pack_crsf_frame(channels):
    """Pack 16 channel values (172..1811) into a CRSF RC frame."""
    payload = bytearray(23)
    payload[0] = CRSF_FRAMETYPE_RC_PACKED
    bits, bits_count, byte_idx = 0, 0, 1
    for ch in channels:
        val = max(172, min(1811, int(ch)))
        bits |= val << bits_count
        bits_count += 11
        while bits_count >= 8 and byte_idx < 23:
            payload[byte_idx] = bits & 0xFF
            bits >>= 8
            bits_count -= 8
            byte_idx += 1
    frame_len = len(payload) + 1
    header = bytes([CRSF_ADDRESS_TX, frame_len])
    crc = crc8_dvb_s2(payload)
    return header + bytes(payload) + bytes([crc])

def pack_crsf_ping(dest=0x00, origin=CRSF_ADDRESS_RADIO):
    """Pack a CRSF Device Ping (0x28) frame to announce handset presence."""
    payload = bytes([CRSF_FRAMETYPE_DEVICE_PING, dest, origin])
    crc = crc8_dvb_s2(payload)
    return bytes([dest if dest != 0x00 else CRSF_SYNC, len(payload) + 1]) + payload + bytes([crc])

def pack_crsf_param_write(field_id=2, value=4):
    """Pack CRSF Parameter Write (0x2D) to configure Telem Ratio (1:16)."""
    payload = bytes([CRSF_FRAMETYPE_PARAM_WRITE, CRSF_ADDRESS_TX, CRSF_ADDRESS_RADIO, field_id, value])
    crc = crc8_dvb_s2(payload)
    return bytes([CRSF_ADDRESS_TX, len(payload) + 1]) + payload + bytes([crc])

def init_elrs_tx(ser):
    """Inisialisasi handshake awal dan aktifkan Telem Ratio (1:16) ke modul TX."""
    try:
        for _ in range(3):
            ser.write(pack_crsf_ping(0x00, CRSF_ADDRESS_RADIO))
            ser.flush()
            time.sleep(0.02)
            ser.write(pack_crsf_ping(CRSF_ADDRESS_TX, CRSF_ADDRESS_RADIO))
            ser.flush()
            time.sleep(0.02)
        for fid in (1, 2, 3):
            ser.write(pack_crsf_param_write(fid, 4))
            ser.flush()
            time.sleep(0.02)
        time.sleep(0.05)
        ser.reset_input_buffer()
        print("[+] Konfigurasi telemetri (Telem Ratio 1:16) berhasil diinjeksi ke modul TX.")
    except Exception as e:
        print(f"[!] Warning saat inisialisasi modul TX: {e}")

def diagnose_tx_output(ser, baud):
    """Diagnosa cepat: apakah modul TX bisa mengirim data balik ke FTDI?"""
    print("[~] Diagnosa half-duplex link...")
    rc = pack_crsf_frame([992]*16)

    # Fase 1: Kirim RC 50Hz selama 2 detik (establish controllerConnected di modul TX)
    for _ in range(100):
        ser.write(rc)
        ser.flush()
        time.sleep(0.02)

    # Bersihkan buffer
    ser.reset_input_buffer()
    time.sleep(0.05)
    ser.reset_input_buffer()

    # Fase 2: Kirim 1 ping, flush, lalu DIAM total 500ms
    ping = pack_crsf_ping(CRSF_ADDRESS_TX, CRSF_ADDRESS_RADIO)
    ser.write(ping)
    ser.flush()

    time.sleep(0.5)
    raw = ser.read(ser.in_waiting or 0)

    if len(raw) > len(ping):
        extra = raw[len(ping):]
        print(f"[+] ✅ Modul TX MERESPONS! ({len(extra)} byte di luar echo)")
        print(f"    Raw response: {extra[:60].hex()}")
        # Parse response frames
        i = 0
        while i < len(extra) - 3:
            if extra[i] in VALID_CRSF_ADDRESSES:
                flen = extra[i+1]
                if 2 <= flen <= 64 and i + flen + 2 <= len(extra):
                    frame = extra[i:i+flen+2]
                    calc_crc = crc8_dvb_s2(frame[2:-1])
                    if calc_crc == frame[-1]:
                        ftype = frame[2]
                        print(f"    [FRAME] Type:0x{ftype:02X} Len:{flen} | {frame.hex()}")
                        i += flen + 2
                        continue
            i += 1
        return True
    elif len(raw) == len(ping):
        print(f"[!] ⚠ Hanya echo ping ({len(ping)} byte) — modul TX TIDAK merespons.")
        print(f"    → Kemungkinan: diode 1N4148 terbalik, atau FTDI RX tidak terhubung.")
        print(f"    → Jalankan: python drone/elrs_diagnostic.py {ser.port} {baud}")
        return False
    else:
        print(f"[!] ⚠ Diterima {len(raw)} byte (expected ≥ {len(ping)}).")
        return False

# ── MSP Attitude Reader ──────────────────────────────────────────────────────
def read_msp_attitude(ser_fc):
    try:
        ser_fc.reset_input_buffer()
        ser_fc.write(bytearray([0x24, 0x4D, 0x3C, 0x00, MSP_ATTITUDE, MSP_ATTITUDE]))
        res = ser_fc.read(18)
        idx = res.find(HEADER_MSP)
        if idx != -1 and len(res) >= idx + 11:
            data = res[idx + 5 : idx + 11]
            roll, pitch, yaw = struct.unpack('<hhh', data)
            return roll / 10.0, pitch / 10.0, float(yaw)
    except Exception:
        pass
    return None, None, None

# ── Auth ─────────────────────────────────────────────────────────────────────
def get_jwt_token():
    try:
        r = requests.post(
            f"{BACKEND_URL}/api/v1/auth/login",
            json={"username": USERNAME, "password": PASSWORD},
            timeout=3
        )
        if r.status_code == 200:
            return r.json().get("access_token")
    except Exception:
        pass
    return None

# ── WebSocket Command Listener ────────────────────────────────────────────────
def start_ws_listener(ws_url, on_command_callback):
    connected_event = threading.Event()
    async def listen():
        first_connect = True
        while True:
            try:
                async with websockets.connect(ws_url) as ws:
                    if first_connect:
                        print(f"[WS] Terhubung ke backend WebSocket — Siap menerima command dari Web!")
                        first_connect = False
                    connected_event.set()
                    async for msg_str in ws:
                        try:
                            msg = json.loads(msg_str)
                            if msg.get("event") == "command":
                                cmd = msg.get("data", {}).get("command")
                                if cmd:
                                    on_command_callback(cmd)
                        except Exception:
                            pass
            except Exception:
                connected_event.clear()
                await asyncio.sleep(2)

    def runner():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(listen())

    threading.Thread(target=runner, daemon=True).start()
    return connected_event

# ── Auto-detect ELRS Port ─────────────────────────────────────────────────────
def auto_detect_elrs_port():
    """Scan COM ports, skip obvious Bluetooth/INAV ports, return first candidate."""
    for p in serial.tools.list_ports.comports():
        desc = p.description.lower()
        if "bluetooth" in desc or "bth" in desc:
            continue
        if p.device in ("COM3", "COM4"):  # known freeze-causing BT ports
            continue
        if p.device == DEFAULT_FC_PORT:
            continue
        return p.device
    return None

# ── Auto-detect FC Port (MSP handshake) ──────────────────────────────────────
def auto_detect_fc_port(exclude_port=None):
    for p in serial.tools.list_ports.comports():
        if p.device == exclude_port:
            continue
        if "bluetooth" in p.description.lower():
            continue
        if p.device in ("COM3", "COM4"):
            continue
        try:
            test = serial.Serial(p.device, DEFAULT_FC_BAUD, timeout=0.15)
            r, pc, y = read_msp_attitude(test)
            test.close()
            if r is not None:
                return p.device
        except Exception:
            pass
    return None

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 68)
    print("  AERO-LINK GCS: Unified Bridge v2.0")
    print("  [ELRS CRSF Wireless + MSP FC Hybrid | FastAPI + WebSocket]")
    print("=" * 68)

    # Parse CLI args
    elrs_port = sys.argv[1] if len(sys.argv) > 1 else None
    elrs_baud = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_ELRS_BAUD
    fc_port   = sys.argv[3] if len(sys.argv) > 3 else None

    # ── Connect to backend ───────────────────────────────────────────────────
    token = get_jwt_token()
    if not token:
        print("[-] Peringatan: Backend FastAPI belum menyala. Telemetri tidak akan dikirim.")
    else:
        print("[+] Login backend berhasil! JWT token aktif.")

    http_session = requests.Session()
    if token:
        http_session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })

    # ── Open ELRS TX Serial ──────────────────────────────────────────────────
    ser_elrs = None
    if not elrs_port:
        elrs_port = auto_detect_elrs_port()
        if elrs_port:
            print(f"[~] Auto-detected ELRS TX port: {elrs_port}")

    if elrs_port:
        try:
            ser_elrs = serial.Serial(elrs_port, elrs_baud, timeout=0.01, write_timeout=0.05)
            print(f"[+] ELRS TX terhubung: {elrs_port} @ {elrs_baud} baud")
            init_elrs_tx(ser_elrs)
            diagnose_tx_output(ser_elrs, elrs_baud)
        except Exception as e:
            print(f"[-] Gagal membuka ELRS port {elrs_port}: {e}")
            ser_elrs = None
    else:
        print("[~] Tidak ada ELRS TX terdeteksi. Mode: Backend-only / offline.")

    # ── Open FC Serial (MSP) ─────────────────────────────────────────────────
    ser_fc = None
    has_fc_msp = False
    if not fc_port:
        fc_port = auto_detect_fc_port(exclude_port=elrs_port)
        if fc_port:
            print(f"[~] Auto-detected FC port (MSP): {fc_port}")

    if fc_port:
        try:
            test_fc = serial.Serial(fc_port, DEFAULT_FC_BAUD, timeout=0.15)
            r, p, y = read_msp_attitude(test_fc)
            if r is not None:
                ser_fc = test_fc
                has_fc_msp = True
                print(f"[+] Flight Controller terdeteksi di {fc_port} via MSP! (Bench-test hybrid aktif)")
            else:
                test_fc.close()
                print(f"[-] Port {fc_port} tidak merespons MSP. FC dilewati.")
        except Exception as e:
            print(f"[-] Gagal membuka FC port {fc_port}: {e}")

    if not ser_elrs and not ser_fc:
        print("\n[!] Tidak ada perangkat hardware terdeteksi.")
        print("    Backend tetap menerima telemetri jika bridge lain (simulator) mengirim data.")
        print("    Jalankan ulang dengan argumen port jika hardware sudah siap.\n")

    # ── Telemetry dict shared state ──────────────────────────────────────────
    telemetry_data = {
        "drone_id": DRONE_ID,
        "latitude": 0.0, "longitude": 0.0,
        "altitude": 0.0, "speed": 0.0,
        "roll": 0.0, "pitch": 0.0, "yaw": 0.0,
        "battery": 0.0,
        "rssi": 0, "snr": 0.0
    }

    channels = [992] * 16
    channels[2] = 172  # Throttle LOW
    channels[4] = 172  # AUX1 (ARM): DISARMED
    channels[5] = 172  # AUX2 (Flight Mode)
    channels[6] = 172  # AUX3 (RTL)

    current_state   = "DISARMED"
    last_telemetry_time = 0.0
    running         = True

    # ── Command handler ──────────────────────────────────────────────────────
    def handle_web_command(cmd):
        nonlocal current_state
        print(f"\n[COMMAND DARI WEB]: >>> {cmd} <<<")
        if cmd == "ARM":
            channels[4] = 1811; current_state = "ARMED"
            print("  -> CH5 (AUX1) = 2000us (ARMED)")
        elif cmd == "DISARM":
            channels[4] = 172; channels[2] = 172
            channels[5] = 172; channels[6] = 172
            current_state = "DISARMED"
            print("  -> CH5 & Throttle = 1000us (DISARMED)")
        elif cmd == "TAKEOFF":
            channels[4] = 1811; channels[5] = 1811; channels[2] = 992
            current_state = "TAKEOFF"
            print("  -> AUX2 = 2000us & Throttle = 1500us (NAV ALTHOLD)")
        elif cmd == "LAND":
            channels[5] = 1811; channels[2] = 172
            current_state = "LANDING"
            print("  -> Throttle = 1000us (LANDING)")
        elif cmd in ("RTL", "RTH"):
            channels[6] = 1811; current_state = "RTL"
            print("  -> CH7 (AUX3) = 2000us (NAV RTH AKTIF!)")

    ws_event = start_ws_listener(BACKEND_WS_URL, handle_web_command)
    ws_event.wait(timeout=1.0)

    # ── MSP attitude poller thread dengan Auto-Reconnect ─────────────────────
    def msp_poller():
        nonlocal ser_fc, has_fc_msp, last_telemetry_time
        consecutive_fc_errors = 0
        while running:
            if not ser_fc:
                # Coba auto-reconnect FC jika sebelumnya ada atau jika fc_port diset
                if fc_port:
                    try:
                        test_fc = serial.Serial(fc_port, DEFAULT_FC_BAUD, timeout=0.15, write_timeout=0.15)
                        r, p, y = read_msp_attitude(test_fc)
                        if r is not None:
                            ser_fc = test_fc
                            has_fc_msp = True
                            consecutive_fc_errors = 0
                            print(f"\n[+] FC ({fc_port}) terhubung kembali via MSP!")
                        else:
                            test_fc.close()
                    except Exception:
                        pass
                time.sleep(1.0)
                continue

            try:
                r, p, y = read_msp_attitude(ser_fc)
                if r is not None:
                    telemetry_data["roll"]  = r
                    telemetry_data["pitch"] = p
                    telemetry_data["yaw"]   = y
                    last_telemetry_time = time.time()
                    consecutive_fc_errors = 0
                else:
                    consecutive_fc_errors += 1
            except Exception as e:
                consecutive_fc_errors += 1

            # Jika FC gagal merespons > 100 kali berturut-turut (~5 detik tanpa respons)
            if consecutive_fc_errors > 100:
                print(f"\n[!] FC di {fc_port} berhenti merespons MSP (>5s). Menutup port untuk reconnect...")
                try:
                    ser_fc.close()
                except Exception:
                    pass
                ser_fc = None
                has_fc_msp = False
                consecutive_fc_errors = 0

            time.sleep(0.05)  # 20Hz polling - stabil untuk buffer USB MSP FC

    threading.Thread(target=msp_poller, daemon=True).start()

    # ── Telemetry POST thread ────────────────────────────────────────────────
    def telemetry_poster():
        while running:
            if token:
                try:
                    payload = dict(telemetry_data)
                    if time.time() - last_telemetry_time > 3.0:
                        payload["rssi"] = 0
                    http_session.post(
                        f"{BACKEND_URL}/api/v1/telemetry",
                        json=payload,
                        timeout=0.15
                    )
                except Exception:
                    pass
            time.sleep(0.04)  # 25Hz

    threading.Thread(target=telemetry_poster, daemon=True).start()

    # ── If no ELRS, just keep posting telemetry (FC-only mode) ───────────────
    if not ser_elrs:
        print("\n[~] Berjalan dalam mode FC-only atau offline. Tekan Ctrl+C untuk keluar.\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            running = False
            print("\n[!] Bridge dihentikan.")
        finally:
            if ser_fc:
                try: ser_fc.close()
                except Exception: pass
        return

    # ── ELRS Main Loop dengan Auto-Reconnect ─────────────────────────────────
    print("\n[+] Transmisi nirkabel aktif! ELRS TX memancar ke RX.")
    print("    • Buka http://localhost:5173 di browser untuk 3D Digital Twin!")
    print("    • Klik ARM / TAKEOFF / LAND di website untuk menguji command.")
    print("    • Auto-reconnect aktif — bridge akan otomatis terhubung kembali jika port terputus.\n")

    buffer    = bytearray()
    last_tx   = 0
    last_disp = 0
    rx_total  = 0
    echo_count = 0
    dl_count   = 0
    crc_errs   = 0
    skip_bytes = 0  # byte yang di-pop (bukan bagian dari frame valid)
    reconnect_delay = 2  # detik, exponential backoff
    tx_frame_counter = 0

    # Pre-compute known sent frame signatures for echo detection
    _rc_signature = pack_crsf_frame(channels)[:3]  # first 3 bytes of RC frame (EE 18 16)
    _known_echo_types = {CRSF_FRAMETYPE_RC_PACKED, CRSF_FRAMETYPE_DEVICE_PING, CRSF_FRAMETYPE_PARAM_WRITE}
    _foreign_bytes_log = bytearray()  # raw non-echo bytes (first 200)

    def run_elrs_loop():
        """Jalankan loop CRSF. Return False jika Ctrl+C, True jika SerialException (retry)."""
        nonlocal ser_elrs, buffer, last_tx, last_disp, rx_total
        nonlocal echo_count, dl_count, crc_errs, skip_bytes, last_telemetry_time, tx_frame_counter

        try:
            while True:
                now = time.time()

                # Kirim tepat 1 frame per 20ms (50Hz) secara bergantian tanpa tabrakan di single-wire
                if now - last_tx >= 0.02:
                    tx_frame_counter += 1
                    try:
                        slot = tx_frame_counter % 50
                        if slot == 10:
                            ser_elrs.write(pack_crsf_ping(0x00, CRSF_ADDRESS_RADIO))
                        elif slot == 20:
                            ser_elrs.write(pack_crsf_ping(CRSF_ADDRESS_TX, CRSF_ADDRESS_RADIO))
                        elif slot == 30:
                            ser_elrs.write(pack_crsf_param_write(2, 4))
                        elif slot == 40:
                            ser_elrs.write(pack_crsf_param_write(3, 4))
                        else:
                            ser_elrs.write(pack_crsf_frame(channels))
                        # KRITIS: flush() memaksa FTDI TX selesai transmit dan kembali ke idle (HIGH).
                        # Tanpa ini, FTDI chip mungkin masih buffer output → pin TX tetap aktif →
                        # modul half-duplex tidak bisa drive line LOW untuk mengirim telemetri balik.
                        ser_elrs.flush()
                    except serial.SerialTimeoutException:
                        ser_elrs.reset_output_buffer()
                    last_tx = now

                # 2. Baca downlink dari ELRS TX
                waiting = ser_elrs.in_waiting
                if waiting > 0:
                    chunk = ser_elrs.read(waiting)
                    rx_total += len(chunk)
                    buffer.extend(chunk)

                # 3. Parse CRSF frames
                while len(buffer) >= 4:
                    if buffer[0] not in VALID_CRSF_ADDRESSES:
                        buffer.pop(0); continue

                    frame_len = buffer[1]
                    if frame_len < 2 or frame_len > 64:
                        buffer.pop(0); continue

                    total_len = frame_len + 2
                    if len(buffer) < total_len:
                        break

                    frame = buffer[:total_len]
                    calc_crc = crc8_dvb_s2(frame[2:-1])
                    if calc_crc != frame[-1]:
                        crc_errs += 1
                        if frame_len >= 4:
                            print(f"\n[CRC-ERR #{crc_errs}] Addr:0x{frame[0]:02X} Len:{frame_len} Type:0x{frame[2]:02X} GotCRC:0x{frame[-1]:02X} CalcCRC:0x{calc_crc:02X} | Hex: {frame.hex()}")
                        buffer.pop(0); continue

                    buffer = buffer[total_len:]
                    ftype   = frame[2]
                    payload = frame[3:-1]

                    if ftype == CRSF_FRAMETYPE_RC_PACKED:
                        echo_count += 1
                    elif ftype in (CRSF_FRAMETYPE_DEVICE_PING, CRSF_FRAMETYPE_PARAM_WRITE):
                        echo_count += 1
                    else:
                        dl_count += 1
                        last_telemetry_time = now
                        print(f"\n[CRSF-DL] Addr:0x{frame[0]:02X} Type:0x{ftype:02X} Len:{len(payload)} | {payload.hex()}")

                    if ftype == CRSF_FRAMETYPE_HANDSET:
                        # OpenTX Sync packet dari modul TX (artinya modul TX aktif berkomunikasi dengan kita!)
                        pass

                    if ftype == CRSF_FRAMETYPE_DEVICE_INFO and len(payload) >= 2:
                        try:
                            dev_name = payload[2:].split(b'\x00')[0].decode('utf-8', errors='ignore')
                            print(f"\n[+] ELRS TX Handshake Terverifikasi! Terdeteksi: '{dev_name}'")
                        except Exception:
                            pass

                    if ftype == CRSF_FRAMETYPE_ATTITUDE and len(payload) >= 6:
                        p_r, r_r, y_r = struct.unpack('>hhh', payload[:6])
                        if abs(p_r) > 3600 or abs(r_r) > 3600:
                            telemetry_data["pitch"] = round(math.degrees(p_r / 10000.0), 1)
                            telemetry_data["roll"]  = round(math.degrees(r_r / 10000.0), 1)
                            telemetry_data["yaw"]   = round(math.degrees(y_r / 10000.0), 1)
                        else:
                            telemetry_data["pitch"] = round(p_r / 10.0, 1)
                            telemetry_data["roll"]  = round(r_r / 10.0, 1)
                            telemetry_data["yaw"]   = round(float(y_r), 1)
                        last_telemetry_time = now

                    elif ftype == CRSF_FRAMETYPE_BATTERY and len(payload) >= 8:
                        _, _, _, remaining = struct.unpack('>HHIB', payload[:8])
                        telemetry_data["battery"] = float(remaining)
                        last_telemetry_time = now

                    elif ftype == CRSF_FRAMETYPE_GPS and len(payload) >= 15:
                        lat, lon, gspeed, _, alt, _ = struct.unpack('>iihhHB', payload[:15])
                        telemetry_data["latitude"]  = round(lat / 1e7, 6)
                        telemetry_data["longitude"] = round(lon / 1e7, 6)
                        telemetry_data["speed"]     = round((gspeed / 10.0) / 3.6, 2)
                        telemetry_data["altitude"]  = round(float(alt) - 1000.0, 2)
                        last_telemetry_time = now

                    elif ftype == CRSF_FRAMETYPE_LINK_STATS and len(payload) >= 7:
                        raw_rssi = payload[0]
                        telemetry_data["rssi"] = -int(raw_rssi) if raw_rssi > 0 else int(raw_rssi)
                        if len(payload) >= 4:
                            telemetry_data["snr"] = float(struct.unpack('b', bytes([payload[3]]))[0])
                        last_telemetry_time = now

                # 4. Display status 20Hz
                if now - last_disp >= 0.05:
                    link_up = (now - last_telemetry_time < 2.0)
                    if has_fc_msp:
                        link_info = f"FC:{fc_port}"
                    elif link_up:
                        link_info = f"RSSI:{telemetry_data['rssi']:3d}dBm"
                    else:
                        link_info = "NO LINK      "
                    print(
                        f"\r[{current_state:9s}] "
                        f"R:{telemetry_data['roll']:5.1f}° P:{telemetry_data['pitch']:5.1f}° Y:{telemetry_data['yaw']:5.1f}° | "
                        f"{link_info:13s} | "
                        f"RX:{rx_total} Echo:{echo_count} DL:{dl_count} CRC-Err:{crc_errs} | "
                        f"CH5:{channels[4]} ",
                        end="", flush=True
                    )
                    last_disp = now

                time.sleep(0.001)

        except serial.SerialException as e:
            print(f"\n\n[!] ELRS port {elrs_port} terputus: {e}")
            return True  # sinyal: lakukan reconnect
        except KeyboardInterrupt:
            return False  # sinyal: hentikan bridge

    # ── Auto-reconnect wrapper ────────────────────────────────────────────────
    try:
        while True:
            should_reconnect = run_elrs_loop()
            if not should_reconnect:
                # Ctrl+C — keluar bersih
                break

            # SerialException — coba reconnect dengan exponential backoff
            try:
                ser_elrs.close()
            except Exception:
                pass
            ser_elrs = None

            print(f"[~] Mencoba reconnect ke {elrs_port} dalam {reconnect_delay}s... (Ctrl+C untuk batal)")
            for _ in range(reconnect_delay * 10):
                time.sleep(0.1)

            try:
                ser_elrs = serial.Serial(elrs_port, elrs_baud, timeout=0.01, write_timeout=0.05)
                buffer.clear()  # flush stale buffer setelah reconnect
                print(f"[+] Reconnect berhasil! {elrs_port} terhubung kembali.\n")
                init_elrs_tx(ser_elrs)
                reconnect_delay = 2  # reset backoff setelah sukses
            except Exception as e:
                print(f"[-] Reconnect gagal: {e}")
                reconnect_delay = min(reconnect_delay * 2, 30)  # max 30s
    finally:
        running = False
        print("\n[!] Bridge dihentikan oleh operator.")
        try: ser_elrs.close() if ser_elrs else None
        except Exception: pass
        if ser_fc:
            try: ser_fc.close()
            except Exception: pass


if __name__ == "__main__":
    main()

