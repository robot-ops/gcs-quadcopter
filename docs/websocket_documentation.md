# WebSocket Documentation - Aero-Link GCS

Aero-Link menggunakan WebSocket untuk menyalurkan aliran data (stream) telemetri berlatensi rendah dari backend ke frontend, serta mengirimkan perintah aksi langsung dari antarmuka pengguna ke wahana.

---

## 1. Koneksi WebSocket
* **Koneksi Endpoint**: `ws://localhost:8000/ws/telemetry`
* **Protokol Handshake**: WebSocket standar, diinisialisasi oleh frontend pada saat aplikasi dimuat.

---

## 2. Struktur Event (Format Data)

Semua pesan yang dilewatkan melalui WebSocket menggunakan format JSON standar dengan struktur pembungkus (*wrapper*) berikut:
```json
{
  "event": "nama_event",
  "data": { ... }
}
```

### 2.1. Server ke Client (Server-to-Client Event)

#### Event: `"telemetry"`
Dikirim secara otomatis oleh backend setiap kali ada data telemetri baru yang masuk melalui endpoint API `POST /api/v1/telemetry`.
* **Payload JSON**:
  ```json
  {
    "event": "telemetry",
    "data": {
      "id": 850,
      "drone_id": 1,
      "latitude": -35.363261,
      "longitude": 149.16523,
      "altitude": 15.2,
      "roll": 3.4,
      "pitch": -1.2,
      "yaw": 90.0,
      "battery": 90,
      "speed": 5.4,
      "rssi": -50,
      "snr": 10.8,
      "created_at": "2026-06-04T17:59:00.123456"
    }
  }
  ```

---

### 2.2. Client ke Server (Client-to-Server Event)

#### Event: `"command"`
Dikirim oleh antarmuka GCS ketika operator menekan tombol aksi penerbangan. Server backend akan menerima data ini dan langsung mem-broadcast-nya ke seluruh client aktif serta bridge hardware.
* **Payload JSON**:
  ```json
  {
    "event": "command",
    "data": {
      "command": "ARM"
    }
  }
  ```
* **Aksi Perintah yang Didukung (`command`)**:
  * `ARM`: Menghidupkan motor drone (mendukung Force Arm MAVLink).
  * `DISARM`: Mematikan motor drone secara paksa.
  * `TAKEOFF`: Mengubah mode ke `GUIDED` dan mengirim perintah lepas landas otomatis.
  * `LAND`: Perintah mendarat otomatis di koordinat aktif.
  * `RTL` / `RTH`: Return to Launch (kembali ke titik keberangkatan).
  * `START_MISSION` / `AUTO`: Memulai misi terbang otonom mengikuti daftar waypoint di Pixhawk.
  * `CALIBRATE_GYRO`: Memicu kalibrasi gyroscope dan barometer Pixhawk.
  * `STABILIZE` / `ALT_HOLD` / `LOITER` / `POSHOLD` / `GUIDED`: Mengganti flight mode ArduCopter secara langsung.

#### Event: `"upload_mission"`
Dikirim oleh Web GCS ketika operator menekan tombol **Upload Mission** pada Mission Planner untuk mengunggah titik-titik waypoint ke EEPROM Pixhawk.
* **Payload JSON**:
  ```json
  {
    "event": "upload_mission",
    "data": {
      "waypoints": [
        { "lat": -6.2088, "lng": 106.8456, "alt": 15.0 },
        { "lat": -6.2092, "lng": 106.8461, "alt": 20.0 }
      ]
    }
  }
  ```

#### Event: `"event_log"`
Dikirim oleh `pixhawk_bridge.py` melalui WebSocket untuk menampilkan pesan log sistem (`STATUSTEXT`, `COMMAND_ACK`, perubahan mode terbang, dan status upload waypoint) secara real-time di Live Event Terminal dashboard.
* **Payload JSON**:
  ```json
  {
    "event": "event_log",
    "data": {
      "text": "[PIXHAWK ACK] ARM/DISARM -> ACCEPTED (Berhasil!)",
      "type": "info",
      "drone_state": "ARMED"
    }
  }
  ```

---

## 3. Penanganan Logika Koneksi di Frontend

Di dalam file `TelemetryContext.jsx`, koneksi WebSocket dikelola menggunakan `useRef` dan diproteksi dengan logika pemulihan otomatis:

1. **Pemantauan Status Koneksi**: Status koneksi diwakili oleh state `isSocketConnected` (boolean). Status ini mengatur indikator status online di panel peta GCS.
2. **Auto-Reconnect Loop**:
   * Jika koneksi terputus secara tidak terduga, event handler `onclose` akan terpicu.
   * State `isSocketConnected` disetel ke `false`.
   * Sistem akan memulai timer `setTimeout` untuk mencoba kembali proses jabat tangan (*handshake*) WebSocket ke alamat server setiap 3 detik.
   * Timer pemulihan ini akan otomatis dibersihkan (*cleared*) ketika koneksi berhasil terhubung kembali atau komponen dimatikan (*unmounted*).
