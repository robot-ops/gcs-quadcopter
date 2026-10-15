import time
import struct
import requests
import serial
import sys

# --- KONFIGURASI ---
SERIAL_PORT = "COM6"      # Port Mateksys FC
BAUDRATE = 115200         # Baudrate MSP INAV default
BACKEND_URL = "http://127.0.0.1:8000"
USERNAME = "admin"
PASSWORD = "admin123"
DRONE_ID = 1

# MSP Command Codes
MSP_IDENT = 100
MSP_STATUS = 101
MSP_RAW_IMU = 102
MSP_ATTITUDE = 108
MSP_ALTITUDE = 109
MSP_ANALOG = 110

def send_msp(ser, cmd):
    # MSP Frame: $M< [size=0] [cmd] [checksum=cmd]
    frame = bytearray([0x24, 0x4D, 0x3C, 0x00, cmd, cmd])
    ser.write(frame)

def read_msp_attitude(ser):
    send_msp(ser, MSP_ATTITUDE)
    time.sleep(0.01)
    res = ser.read(ser.in_waiting)
    if len(res) >= 12 and res[0:3] == b'$M>':
        # $M> + size(1) + type(1) + roll(2) + pitch(2) + yaw(2) + crc(1)
        data = res[5:11]
        roll, pitch, yaw = struct.unpack('<hhh', data)
        return roll / 10.0, pitch / 10.0, float(yaw)
    return None, None, None

def get_jwt_token():
    print(f"[+] Autentikasi ke Backend Aero-Link ({BACKEND_URL})...")
    try:
        r = requests.post(f"{BACKEND_URL}/api/v1/auth/login", json={"username": USERNAME, "password": PASSWORD})
        if r.status_code == 200:
            print("[+] Login backend berhasil! JWT token didapatkan.")
            return r.json().get("access_token")
    except Exception as e:
        print(f"[-] Backend belum aktif: {e}")
    return None

def main():
    print("=" * 65)
    print("  AERO-LINK GCS: Mateksys (INAV) to 3D Digital Twin Live Bridge")
    print("=" * 65)

    token = get_jwt_token()
    if not token:
        print("[-] Pastikan backend FastAPI sudah berjalan di port 8000!")
        return

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    port = sys.argv[1] if len(sys.argv) > 1 else SERIAL_PORT
    print(f"[+] Menghubungkan ke Flight Controller Mateksys di {port}...")
    try:
        ser = serial.Serial(port, BAUDRATE, timeout=0.1)
        print(f"[+] Port {port} terbuka! Membaca sensor giro & akselerometer...")
    except Exception as e:
        print(f"[-] Gagal membuka port {port}: {e}")
        print("    Pastikan Anda sudah klik DISCONNECT di INAV Configurator!")
        return

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

    print("\n[+] LIVE STREAM TELEMETRI AKTIF! Buka http://localhost:5173 di browser.")
    print("    Miringkan drone/FC dengan tangan untuk melihat Digital Twin 3D bergerak!\n")

    last_send = 0
    try:
        while True:
            r, p, y = read_msp_attitude(ser)
            if r is not None:
                telemetry_data["roll"] = r
                telemetry_data["pitch"] = p
                telemetry_data["yaw"] = y

            now = time.time()
            if now - last_send >= 0.05:  # Kirim 20Hz (setiap 50ms) ke 3D Digital Twin
                try:
                    requests.post(f"{BACKEND_URL}/api/v1/telemetry", json=telemetry_data, headers=headers, timeout=0.1)
                    print(f"\r[3D TWIN] Roll: {telemetry_data['roll']:6.1f}° | Pitch: {telemetry_data['pitch']:6.1f}° | Yaw: {telemetry_data['yaw']:6.1f}°   ", end="", flush=True)
                except Exception:
                    pass
                last_send = now

            time.sleep(0.01)

    except KeyboardInterrupt:
        print("\n[!] Bridge dihentikan.")
    finally:
        ser.close()

if __name__ == "__main__":
    main()
