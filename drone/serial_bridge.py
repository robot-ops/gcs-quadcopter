import time
import struct
import requests
import argparse
import sys
import threading
import json
import asyncio

# --- CONFIGURATION DEFAULT ---
DEFAULT_PORT = "COM3"
DEFAULT_BAUD = 115200
DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"
USERNAME = "admin"
PASSWORD = "admin123"

# Ukuran paket biner telemetri (28 bytes)
PACKET_SIZE = 28

# Context bersama yang bisa diakses antar thread
shared_context = {
    "headers": {},
    "token": "",
    "backend_url": "",
    "running": True
}

def calculate_crc16(data: bytes) -> int:
    """Menghitung CRC-16 CCITT (Poly: 0x1021, Init: 0x0000)"""
    crc = 0x0000
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc

def get_jwt_token(backend_url):
    print(f"Authenticating with backend at {backend_url}...")
    try:
        response = requests.post(f"{backend_url}/api/v1/auth/login", json={
            "username": USERNAME,
            "password": PASSWORD
        }, timeout=5.0)
        if response.status_code == 200:
            token = response.json().get("access_token")
            print("Successfully authenticated and obtained JWT token.")
            return token
        else:
            print(f"Authentication failed with status: {response.status_code}, response: {response.text}")
            return None
    except Exception as e:
        print(f"Error connecting to backend for auth: {e}")
        return None

def refresh_token():
    """Mengambil token JWT baru dan memperbarui header untuk request HTTP"""
    token = get_jwt_token(shared_context["backend_url"])
    if token:
        shared_context["token"] = token
        shared_context["headers"] = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        return True
    return False

def serial_reader_thread(ser):
    """Thread pembaca serial: menerima data biner dari ESP32 dan mengirimkannya ke API backend"""
    print("Serial reader thread started. Reading telemetry from ESP32...")
    
    # Inisialisasi awal serial buffer
    ser.reset_input_buffer()
    
    while shared_context["running"]:
        try:
            # Cari sync byte / magic byte: 0xAA
            start_byte = ser.read(1)
            if not start_byte:
                continue
            
            if start_byte[0] == 0xAA:
                # Membaca sisa paket (27 bytes lagi)
                remaining_bytes = ser.read(PACKET_SIZE - 1)
                if len(remaining_bytes) < (PACKET_SIZE - 1):
                    # Data tidak lengkap (timeout)
                    continue
                
                packet_data = start_byte + remaining_bytes
                
                # Unpack bagian CRC (2 bytes terakhir) dan hitung CRC pada 26 bytes pertama
                calculated_crc = calculate_crc16(packet_data[:26])
                received_crc = struct.unpack('<H', packet_data[26:28])[0]
                
                if calculated_crc != received_crc:
                    print(f"[Serial] Peringatan: CRC mismatch! Hitung: {calculated_crc:#x}, Terima: {received_crc:#x}")
                    continue
                
                # Dekode data biner (little-endian)
                try:
                    unpacked = struct.unpack('<BBiihhhHBHbhH', packet_data[:26])
                    
                    # Konversi nilai skema pembagian sesuai lora_protocol.md
                    drone_id = unpacked[1]
                    latitude = unpacked[2] / 1e7
                    longitude = unpacked[3] / 1e7
                    altitude = unpacked[4] / 10.0  # desimeter ke meter
                    roll = unpacked[5] / 100.0      # skala 100
                    pitch = unpacked[6] / 100.0     # skala 100
                    yaw = unpacked[7] / 100.0       # skala 100
                    battery = float(unpacked[8])
                    speed = unpacked[9] / 100.0     # skala 100
                    rssi = int(unpacked[10])
                    snr = unpacked[11] / 10.0       # skala 10
                    counter = unpacked[12]
                    
                    # Siapkan payload JSON untuk dikirim ke backend
                    telemetry_payload = {
                        "drone_id": drone_id,
                        "latitude": latitude,
                        "longitude": longitude,
                        "altitude": altitude,
                        "roll": roll,
                        "pitch": pitch,
                        "yaw": yaw,
                        "battery": battery,
                        "speed": speed,
                        "rssi": rssi,
                        "snr": snr
                    }
                    
                    # POST ke FastAPI backend
                    try:
                        response = requests.post(
                            f"{shared_context['backend_url']}/api/v1/telemetry",
                            json=telemetry_payload,
                            headers=shared_context["headers"],
                            timeout=0.5
                        )
                        
                        if response.status_code == 200:
                            print(f"[Packet #{counter}] Telemetry Sent -> Lat: {latitude:.6f}, Lng: {longitude:.6f}, "
                                  f"Alt: {altitude:.1f}m, Roll: {roll:.1f}°, Pitch: {pitch:.1f}°, "
                                  f"Yaw: {yaw:.1f}°, Battery: {battery:.0f}%")
                        elif response.status_code == 401:
                            print("[Serial] JWT Token expired. Refreshing token...")
                            refresh_token()
                        else:
                            print(f"[Serial] Failed posting telemetry. Status: {response.status_code}")
                    except requests.exceptions.RequestException as e:
                        # Log error tanpa membanjiri terminal jika backend mati
                        pass
                        
                except struct.error as e:
                    print(f"[Serial] Gagal membongkar paket: {e}")

        except Exception as e:
            if shared_context["running"]:
                print(f"[Serial] Error di serial reader thread: {e}")
                time.sleep(1.0)


async def websocket_client_task(ser):
    """Task asynchronous: menghubungkan ke server WebSocket backend dan mendengarkan command dari GCS"""
    import websockets
    
    # Ubah http:// menjadi ws://
    ws_url = shared_context["backend_url"].replace("http://", "ws://") + "/ws/telemetry"
    
    while shared_context["running"]:
        try:
            print(f"[WebSocket] Menghubungkan ke {ws_url}...")
            async with websockets.connect(ws_url) as websocket:
                print("[WebSocket] Terhubung! Mendengarkan perintah (commands) dari GCS Dashboard...")
                
                async for message in websocket:
                    if not shared_context["running"]:
                        break
                    
                    try:
                        msg = json.loads(message)
                        # Filter event command dari GCS
                        if msg.get("event") == "command":
                            cmd_data = msg.get("data", {})
                            command = cmd_data.get("command")
                            
                            if command:
                                print(f"[WebSocket] Menerima Perintah dari Dashboard: {command}")
                                
                                # Format perintah serial: "CMD:<command>\n"
                                serial_cmd = f"CMD:{command}\n"
                                
                                # Tulis perintah ke ESP32 melalui Serial USB
                                ser.write(serial_cmd.encode('utf-8'))
                                ser.flush()
                                print(f"[Serial] Menulis perintah ke ESP32: {serial_cmd.strip()}")
                                
                    except Exception as e:
                        print(f"[WebSocket] Gagal parsing pesan: {e}")
                        
        except Exception as e:
            if shared_context["running"]:
                print(f"[WebSocket] Koneksi terputus: {e}. Mencoba menghubungkan kembali dalam 3 detik...")
                await asyncio.sleep(3.0)


def main():
    parser = argparse.ArgumentParser(description="Aero-Link GCS - Two-Way ESP32 Telemetry & Control Bridge")
    parser.add_argument("--port", type=str, default=DEFAULT_PORT, help="COM port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=DEFAULT_BAUD, help="Baud rate (default: 115200)")
    parser.add_argument("--url", type=str, default=DEFAULT_BACKEND_URL, help="Backend URL (default: http://127.0.0.1:8000)")
    args = parser.parse_args()

    # Pastikan pyserial dan websockets terinstal
    try:
        import serial
    except ImportError:
        print("\nERROR: Modul 'pyserial' belum terinstal.")
        print("Silakan jalankan perintah berikut:")
        print("  pip install pyserial\n")
        sys.exit(1)
        
    try:
        import websockets
    except ImportError:
        print("\nERROR: Modul 'websockets' belum terinstal.")
        print("Silakan jalankan perintah berikut:")
        print("  pip install websockets\n")
        sys.exit(1)

    shared_context["backend_url"] = args.url

    # Autentikasi awal
    if not refresh_token():
        print("Gagal memulai bridge karena autentikasi awal ke backend gagal.")
        sys.exit(1)

    # Buka port serial
    print(f"Membuka port serial {args.port} dengan baud rate {args.baud}...")
    try:
        ser = serial.Serial(args.port, args.baud, timeout=1.0)
    except serial.SerialException as e:
        print(f"Gagal membuka port serial {args.port}: {e}")
        print("Pastikan port sudah benar dan tidak sedang dibuka oleh Arduino IDE Serial Monitor.")
        sys.exit(1)

    # Mulai thread pembaca serial
    reader_thread = threading.Thread(target=serial_reader_thread, args=(ser,), daemon=True)
    reader_thread.start()

    # Jalankan loop async untuk WebSocket di thread utama
    try:
        asyncio.run(websocket_client_task(ser))
    except KeyboardInterrupt:
        print("\nBridge dihentikan oleh pengguna.")
    finally:
        shared_context["running"] = False
        ser.close()
        print("Koneksi serial ditutup. Selesai.")

if __name__ == "__main__":
    main()
