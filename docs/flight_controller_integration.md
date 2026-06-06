# Flight Controller Integration - Aero-Link GCS

Aero-Link terintegrasi dengan Flight Controller fisik berbasis firmware **ArduPilot (ArduCopter)** menggunakan protokol komunikasi standar **MAVLink (Micro Air Vehicle Link)**.

---

## 1. Pesan MAVLink yang Digunakan

Sistem jembatan telemetri (`drone/sitl_bridge.py`) memfilter aliran data MAVLink dari flight controller dan mengekstrak pesan spesifik berikut:

### 1.1. `GLOBAL_POSITION_INT` (Message ID: #33)
Digunakan untuk melacak posisi koordinat dan ketinggian drone berdasarkan kalkulasi sensor EKF (Extended Kalman Filter).
* **`lat`**: Latitude ($\text{derajat} \times 10^7$).
* **`lon`**: Longitude ($\text{derajat} \times 10^7$).
* **`relative_alt`**: Ketinggian relatif di atas titik home takeoff (milimeter, dikonversi ke meter).

### 1.2. `ATTITUDE` (Message ID: #30)
Digunakan untuk menyinkronkan sikap kemiringan fisik drone dengan model visual 3D Digital Twin.
* **`roll`**: Sudut kemiringan lateral (Radian, dikonversi ke derajat).
* **`pitch`**: Sudut kemiringan membujur (Radian, dikonversi ke derajat).
* **`yaw`**: Sudut hadap kompas (Radian, dikonversi ke derajat kompas).

### 1.3. `VFR_HUD` (Message ID: #74)
Digunakan untuk membaca data navigasi instrumen utama penerbangan.
* **`groundspeed`**: Kecepatan gerak drone relatif terhadap tanah (m/s).

### 1.4. `SYS_STATUS` (Message ID: #1)
Digunakan untuk memantau status daya kelistrikan utama sistem wahana.
* **`battery_remaining`**: Kapasitas sisa baterai (persentase, 0-100%).

---

## 2. Topologi Integrasi Perangkat Keras Fisik

```
  [ Flight Controller (Pixhawk/Orange Cube) ]
                      │
                      │ (MAVLink over Telem1/Telem2 Serial port)
                      ▼
        [ Companion Computer (Raspberry Pi) ]
                      │
                      │ (Koneksi WiFi, Ethernet, atau Radio Modul LoRa)
                      ▼
        [ Ground Station Laptop / GCS Bridge ]
                      │
                      │ (HTTP POST JSON payload)
                      ▼
            [ FastAPI Backend Server ]
```

### 2.1. Koneksi Serial Pixhawk ke Raspberry Pi
Untuk menghubungkan Pixhawk dengan Raspberry Pi pendamping:
1. Hubungkan pin **TX** telemetry port Pixhawk ke pin **RX (GPIO 15 - Pin 10)** Raspberry Pi.
2. Hubungkan pin **RX** telemetry port Pixhawk ke pin **TX (GPIO 14 - Pin 8)** Raspberry Pi.
3. Hubungkan pin **GND** Pixhawk ke pin **GND** Raspberry Pi.
4. Di sisi ArduPilot, atur parameter baud rate telemetry:
   * `SERIAL1_PROTOCOL` = `2` (MAVLink 2)
   * `SERIAL1_BAUD` = `57` (57600 baud rate) atau `921` (921600 baud rate) untuk transfer data berkecepatan tinggi.

---

## 3. Ekstraksi Data via Python Bridge
Bridge telemetri menggunakan library `pymavlink` untuk menangkap data MAVLink dari port serial atau UDP stream:
```python
from pymavlink import mavutil

# Koneksi ke port serial Raspberry Pi
master = mavutil.mavlink_connection('/dev/ttyAMA0', baud=57600)

# Menunggu pesan telemetri masuk
msg = master.recv_match(type='ATTITUDE', blocking=True)
if msg:
    roll_deg = math.degrees(msg.roll)
    pitch_deg = math.degrees(msg.pitch)
    yaw_deg = math.degrees(msg.yaw)
```
Data yang diekstrak kemudian dikirim melalui request HTTP ke API FastAPI untuk diperbarui secara real-time di UI.
