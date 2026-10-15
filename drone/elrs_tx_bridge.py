import time
import struct
import requests
import serial
import serial.tools.list_ports
import sys
import threading
import asyncio
import json
import websockets
import math

SERIAL_PORT = "COM8"
BAUDRATE = 115200
BACKEND_URL = "http://127.0.0.1:8000"
BACKEND_WS_URL = "ws://127.0.0.1:8000/ws/telemetry"
USERNAME = "admin"
PASSWORD = "admin123"
DRONE_ID = 1

CRSF_ADDRESS_CRSF_TRANSMITTER = 0xEE
CRSF_ADDRESS_RADIO_TRANSMITTER = 0xEA
CRSF_SYNC = 0xC8
CRSF_FRAMETYPE_ATTITUDE = 0x1E
CRSF_FRAMETYPE_BATTERY_SENSOR = 0x08
CRSF_FRAMETYPE_GPS = 0x02
CRSF_FRAMETYPE_LINK_STATISTICS = 0x14
CRSF_FRAMETYPE_RC_CHANNELS_PACKED = 0x16

MSP_ATTITUDE = 108

def crc8_dvb_s2(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0xD5) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc

def pack_crsf_frame(channels):
    """
    channels: list of 16 integers (172..1811)
    172 = 1000us (Low)
    992 = 1500us (Center)
    1811 = 2000us (High)
    """
    payload = bytearray(23)
    payload[0] = CRSF_FRAMETYPE_RC_CHANNELS_PACKED
    bits = 0
    bits_count = 0
    byte_idx = 1
    for ch in channels:
        val = max(172, min(1811, int(ch)))
        bits |= (val << bits_count)
        bits_count += 11
        while bits_count >= 8 and byte_idx < 23:
            payload[byte_idx] = bits & 0xFF
            bits >>= 8
            bits_count -= 8
            byte_idx += 1
    frame_len = len(payload) + 1
    header = bytes([CRSF_ADDRESS_CRSF_TRANSMITTER, frame_len])
    crc = crc8_dvb_s2(payload)
    return header + bytes(payload) + bytes([crc])

HEADER_MSP = bytes([0x24, 0x4D, 0x3E])

def read_msp_attitude(ser_fc):
    try:
        ser_fc.reset_input_buffer()
        ser_fc.write(bytearray([0x24, 0x4D, 0x3C, 0x00, MSP_ATTITUDE, MSP_ATTITUDE]))
        res = ser_fc.read(12)
        if len(res) == 12 and res[:3] == HEADER_MSP:
            data = res[5:11]
            roll, pitch, yaw = struct.unpack('<hhh', data)
            return roll / 10.0, pitch / 10.0, float(yaw)
    except Exception:
        pass
    return None, None, None

def get_jwt_token():
    try:
        r = requests.post(f"{BACKEND_URL}/api/v1/auth/login", json={"username": USERNAME, "password": PASSWORD}, timeout=2)
        if r.status_code == 200:
            return r.json().get("access_token")
    except Exception:
        pass
    return None

def start_ws_listener(ws_url, on_command_callback):
    async def listen():
        while True:
            try:
                async with websockets.connect(ws_url) as ws:
                    print(f"\n[WS] Terhubung ke WebSocket Backend ({ws_url}) — Siap menerima command dari Web!")
                    while True:
                        msg_str = await ws.recv()
                        try:
                            msg = json.loads(msg_str)
                            if msg.get("event") == "command":
                                cmd = msg.get("data", {}).get("command")
                                if cmd:
                                    on_command_callback(cmd)
                        except Exception:
                            pass
            except Exception:
                await asyncio.sleep(2)

    def runner():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(listen())

    t = threading.Thread(target=runner, daemon=True)
    t.start()

def main():
    print("=" * 68)
    print("  AERO-LINK GCS: Happymodel ELRS (LoRa) Bench-Test Bridge")
    print("  [Kontrol Dua Arah: Web Command -> TX/RX -> Matek FC -> Telemetri]")
    print("=" * 68)

    token = get_jwt_token()
    if not token:
        print("[-] Peringatan: Backend FastAPI di port 8000 belum menyala.")
        print("    Jalankan backend terlebih dahulu agar telemetri & command tersambung.")
    else:
        print("[+] Login backend berhasil! JWT token aktif.")

    headers = {
        "Authorization": f"Bearer {token}" if token else "",
        "Content-Type": "application/json"
    }

    port = sys.argv[1] if len(sys.argv) > 1 else SERIAL_PORT
    baud = int(sys.argv[2]) if len(sys.argv) > 2 else BAUDRATE

    print(f"[+] Membuka port Happymodel TX di {port} @ {baud} baud...")
    try:
        ser = serial.Serial(port, baud, timeout=0.01)
    except Exception as e:
        print(f"[-] Gagal membuka serial {port}: {e}")
        print("    Petunjuk: Cek Device Manager untuk memastikan port COM modul Happymodel Anda.")
        print(f"    Gunakan: python elrs_tx_bridge.py COMx")
        return

    # Inisialisasi 16 channel CRSF (172 = 1000us, 992 = 1500us, 1811 = 2000us)
    channels = [992] * 16
    channels[2] = 172  # Throttle: 172 (Low / 1000us)
    channels[4] = 172  # AUX1 (Arming): 172 (DISARMED)
    channels[5] = 172  # AUX2 (Flight Mode / Nav): 172
    channels[6] = 172  # AUX3 (Emergency RTL): 172

    current_state = "DISARMED"

    def handle_web_command(cmd):
        nonlocal current_state
        print(f"\n[COMMAND DITERIMA DARI WEB]: >>> {cmd} <<<")
        if cmd == "ARM":
            channels[4] = 1811  # AUX1 HIGH (ARM)
            current_state = "ARMED"
            print("  -> CH5 (AUX1) di-set ke 2000us (ARMED)")
        elif cmd == "DISARM":
            channels[4] = 172   # AUX1 LOW (DISARM)
            channels[2] = 172   # Throttle LOW
            channels[5] = 172   # Mode Normal
            channels[6] = 172   # RTL OFF
            current_state = "DISARMED"
            print("  -> CH5 (AUX1) & Throttle di-set ke 1000us (DISARMED)")
        elif cmd == "TAKEOFF":
            channels[4] = 1811  # Pastikan ARM
            channels[5] = 1811  # AUX2 HIGH (NAV ALTHOLD / POSHOLD)
            channels[2] = 992   # Throttle CENTER (Hover 1500us)
            current_state = "TAKEOFF / HOVER"
            print("  -> AUX2 di-set ke 2000us & Throttle 1500us (NAV ALTHOLD / POSHOLD)")
        elif cmd == "LAND":
            channels[5] = 1811  # AUX2 HIGH
            channels[2] = 172   # Throttle LOW
            current_state = "LANDING"
            print("  -> Throttle di-set ke 1000us (LANDING)")
        elif cmd == "RTL" or cmd == "RTH":
            channels[6] = 1811  # AUX3 HIGH (NAV RTH)
            current_state = "EMERGENCY RTL"
            print("  -> CH7 (AUX3) di-set ke 2000us (NAV RTH DIAKTIFKAN!)")

    # Jalankan listener WebSocket di background
    start_ws_listener(BACKEND_WS_URL, handle_web_command)

    # Format telemetri default sinkron persis dengan inav_bridge.py
    telemetry_data = {
        "drone_id": DRONE_ID,
        "latitude": -6.2088,
        "longitude": 106.8456,
        "altitude": 1.5,
        "roll": 0.0,
        "pitch": 0.0,
        "yaw": 0.0,
        "battery": 98.0,
        "speed": 0.0,
        "rssi": -45,
        "snr": 15.0
    }

    last_telemetry_time = time.time()
    has_fc_msp = False
    fc_port_name = None

    # Opsi port FC untuk MSP attitude sync: parameter ke-3 atau auto-detect hanya jika COM6 ada (BUKAN Bluetooth!)
    fc_port_cand = sys.argv[3] if len(sys.argv) > 3 else None
    if not fc_port_cand:
        for p in serial.tools.list_ports.comports():
            if p.device == "COM6" and "bluetooth" not in p.description.lower():
                fc_port_cand = "COM6"
                break

    ser_fc = None
    if fc_port_cand:
        try:
            test_ser = serial.Serial(fc_port_cand, 115200, timeout=0.1)
            r, p, y = read_msp_attitude(test_ser)
            if r is not None:
                ser_fc = test_ser
                fc_port_name = fc_port_cand
                has_fc_msp = True
                print(f"[+] Bench-Test Hybrid: Flight Controller terdeteksi di {fc_port_cand} via MSP!")
                print(f"    • Kontrol: 100% Wireless via Happymodel ELRS ({port})")
                print(f"    • Sensor Giro & Attitude: Sinkron live dari Matek FC ({fc_port_cand})")
            else:
                test_ser.close()
        except Exception:
            pass

    running = True

    # Thread pembaca MSP dari FC jika terhubung di bench test
    def msp_poller():
        nonlocal ser_fc, has_fc_msp, last_telemetry_time
        while running and ser_fc:
            try:
                r, p, y = read_msp_attitude(ser_fc)
                if r is not None:
                    telemetry_data["roll"] = r
                    telemetry_data["pitch"] = p
                    telemetry_data["yaw"] = y
                    last_telemetry_time = time.time()
            except Exception:
                pass
            time.sleep(0.025)  # 40Hz ultra-smooth gyro polling!

    if ser_fc:
        t_msp = threading.Thread(target=msp_poller, daemon=True)
        t_msp.start()

    # Session persistent untuk koneksi HTTP keep-alive tanpa overhead TCP handshake
    http_session = requests.Session()
    if headers:
        http_session.headers.update(headers)

    # Background thread untuk mengirim data ke backend FastAPI (25Hz)
    def telemetry_poster():
        while running:
            if token:
                try:
                    payload = dict(telemetry_data)
                    # Jika tidak ada link sama sekali selama 3 detik
                    if time.time() - last_telemetry_time > 3.0:
                        payload["rssi"] = 0
                    http_session.post(f"{BACKEND_URL}/api/v1/telemetry", json=payload, timeout=0.1)
                except Exception:
                    pass
            time.sleep(0.04)  # 25Hz live stream ke 3D Digital Twin

    t_post = threading.Thread(target=telemetry_poster, daemon=True)
    t_post.start()

    buffer = bytearray()
    last_tx = 0
    last_display = 0
    total_rx_bytes = 0
    echo_count = 0
    downlink_count = 0
    crc_err_count = 0

    print("\n[+] Transmisi nirkabel aktif! Happymodel TX memancar ke Matek/XR1 RX.")
    print("    • Buka http://localhost:5173 di browser untuk melihat 3D Digital Twin!")
    print("    • Klik tombol ARM / TAKEOFF / LAND di Website untuk menguji Command.\n")

    VALID_CRSF_ADDRESSES = (0x00, 0xC8, 0xEA, 0xEC, 0xEE, 0xEF, 0x18)

    try:
        while True:
            now = time.time()

            # 1. Kirim paket channel CRSF ke Happymodel TX setiap 10ms (100Hz presisi tanpa lag)
            if now - last_tx >= 0.01:
                frame = pack_crsf_frame(channels)
                ser.write(frame)
                last_tx = now

            # 2. Baca telemetri downlink nirkabel balik dari Matek FC via RX
            waiting = ser.in_waiting
            if waiting > 0:
                chunk = ser.read(waiting)
                total_rx_bytes += len(chunk)
                buffer.extend(chunk)

            while len(buffer) >= 4:
                if buffer[0] not in VALID_CRSF_ADDRESSES:
                    buffer.pop(0)
                    continue

                frame_len = buffer[1]
                if frame_len < 2 or frame_len > 64:
                    buffer.pop(0)
                    continue

                total_len = frame_len + 2
                if len(buffer) < total_len:
                    break

                frame = buffer[:total_len]
                expected_crc = frame[-1]
                calc_crc = crc8_dvb_s2(frame[2:-1])
                if calc_crc != expected_crc:
                    crc_err_count += 1
                    buffer.pop(0)
                    continue

                buffer = buffer[total_len:]
                frame_type = frame[2]
                payload = frame[3:-1]

                # Jika ada frame selain RC Channels echo, berarti downlink nirkabel aktif!
                if frame_type == CRSF_FRAMETYPE_RC_CHANNELS_PACKED:
                    echo_count += 1
                else:
                    downlink_count += 1
                    last_telemetry_time = now
                    print(f"\n[CRSF-DOWNLINK DITERIMA] Header:0x{frame[0]:02X} Type:0x{frame_type:02X} Len:{len(payload)} Hex:{payload.hex()}")

                if frame_type == CRSF_FRAMETYPE_ATTITUDE and len(payload) >= 6:
                    last_telemetry_time = now
                    p_raw, r_raw, y_raw = struct.unpack('>hhh', payload[:6])
                    if abs(p_raw) > 3600 or abs(r_raw) > 3600:
                        telemetry_data["pitch"] = round(math.degrees(p_raw / 10000.0), 1)
                        telemetry_data["roll"] = round(math.degrees(r_raw / 10000.0), 1)
                        telemetry_data["yaw"] = round(math.degrees(y_raw / 10000.0), 1)
                    else:
                        telemetry_data["pitch"] = round(p_raw / 10.0, 1)
                        telemetry_data["roll"] = round(r_raw / 10.0, 1)
                        telemetry_data["yaw"] = round(float(y_raw), 1)

                elif frame_type == CRSF_FRAMETYPE_BATTERY_SENSOR and len(payload) >= 8:
                    last_telemetry_time = now
                    voltage, current, capacity, remaining = struct.unpack('>HHIB', payload[:8])
                    telemetry_data["battery"] = float(remaining)

                elif frame_type == CRSF_FRAMETYPE_GPS and len(payload) >= 15:
                    last_telemetry_time = now
                    lat, lon, gspeed, heading, alt, sats = struct.unpack('>iihhHB', payload[:15])
                    telemetry_data["latitude"] = round(lat / 1e7, 6)
                    telemetry_data["longitude"] = round(lon / 1e7, 6)
                    telemetry_data["speed"] = round((gspeed / 10.0) / 3.6, 2)
                    telemetry_data["altitude"] = round(float(alt) - 1000.0, 2)

                elif frame_type == CRSF_FRAMETYPE_LINK_STATISTICS and len(payload) >= 7:
                    last_telemetry_time = now
                    raw_rssi = payload[0]
                    telemetry_data["rssi"] = -int(raw_rssi) if raw_rssi > 0 else int(raw_rssi)
                    if len(payload) >= 4:
                        telemetry_data["snr"] = float(struct.unpack('b', bytes([payload[3]]))[0])

            # 3. Tampilkan status di konsol setiap 50ms (20Hz realtime)
            if now - last_display >= 0.05:
                is_link_up = (now - last_telemetry_time < 2.0)
                if has_fc_msp:
                    link_info = f"FC:{fc_port_name}"
                elif is_link_up:
                    link_info = f"RSSI:{telemetry_data['rssi']:3d}dBm"
                else:
                    link_info = "NO LINK"

                print(f"\r[STATUS:{current_state:9s}] R:{telemetry_data['roll']:5.1f}° P:{telemetry_data['pitch']:5.1f}° Y:{telemetry_data['yaw']:5.1f}° | {link_info:11s} | RX:{total_rx_bytes} Echo:{echo_count} DL:{downlink_count} CRC-Err:{crc_err_count} | CH5:{channels[4]} ", end="", flush=True)
                last_display = now

            time.sleep(0.001)

    except serial.SerialException as e:
        running = False
        print(f"\n\n[-] Kabel serial {port} terputus / dicabut: {e}")
    except KeyboardInterrupt:
        running = False
        print("\n\n[!] Bridge dihentikan oleh operator.")
    finally:
        try:
            ser.close()
        except Exception:
            pass
        if ser_fc:
            try:
                ser_fc.close()
            except Exception:
                pass

if __name__ == "__main__":
    main()

