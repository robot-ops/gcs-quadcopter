# LoRa Communication Protocol - Aero-Link GCS

Radio LoRa (Long Range) memiliki keterbatasan bandwidth dan ukuran payload maksimum (MTU < 256 bytes). Untuk memastikan transmisi telemetri jarak jauh yang andal tanpa mengandalkan koneksi internet, data dikompresi menjadi struktur biner ringkas berukuran **29 Bytes**.

---

## 1. Struktur Payload Biner (Packed Struct - 29 Bytes)

Data telemetri diserialisasikan secara berurutan menjadi deretan biner. Nilai pecahan (float) dikalikan dengan faktor skala tertentu untuk dikonversi menjadi tipe data integer guna menghemat ukuran byte.

| Byte Offset | Ukuran (Bytes) | Tipe Data | Variabel Telemetri | Faktor Skala / Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **0 - 1** | 2 | UINT16 | `Header & ID` | Magic Bytes `0xAA` (Byte 0) + Drone ID (Byte 1) |
| **2 - 5** | 4 | INT32 | `Latitude` | Koordinat $\text{lintang} \times 10^7$ (Presisi 7 desimal) |
| **6 - 9** | 4 | INT32 | `Longitude` | Koordinat $\text{bujur} \times 10^7$ (Presisi 7 desimal) |
| **10 - 11** | 2 | INT16 | `Altitude` | Ketinggian relatif dalam desimeter (Skala $\times 10$) |
| **12 - 13** | 2 | INT16 | `Roll` | Sudut lateral $\times 100$ (Skala $\times 100$) |
| **14 - 15** | 2 | INT16 | `Pitch` | Sudut longitudinal $\times 100$ (Skala $\times 100$) |
| **16 - 17** | 2 | UINT16 | `Yaw` | Sudut hadap kompas $\times 100$ (Skala $\times 100$) |
| **18** | 1 | UINT8 | `Battery` | Persentase kapasitas baterai (0 - 100) |
| **19 - 20** | 2 | UINT16 | `Speed` | Kecepatan gerak tanah $\times 100$ (Skala $\times 100$) dalam m/s |
| **21** | 1 | INT8 | `RSSI` | Kekuatan sinyal transceiver penerima (dBm) |
| **22 - 23** | 2 | INT16 | `SNR` | Signal-to-Noise Ratio $\times 10$ (Skala $\times 10$) dalam dB |
| **24 - 25** | 2 | UINT16 | `Counter` | Nomor urut paket untuk memonitor persentase paket hilang |
| **26 - 27** | 2 | UINT16 | `Checksum` | CRC-16 Checksum untuk mendeteksi kerusakan data |

---

## 2. Parameter Fisik Radio Frekuensi (RF)

Agar penerimaan data stabil pada jarak jauh, parameter transceiver LoRa (misal RF chip SX1276) harus disinkronkan antara pemancar (UAV) dan penerima (Ground Station):

* **Carrier Frequency**: `915.0 MHz` (atau disesuaikan dengan regulasi band ISM lokal seperti `433 MHz` / `868 MHz`).
* **Spreading Factor (SF)**: `SF7`. Memberikan trade-off terbaik antara waktu transmisi di udara (*Airtime* rendah) dan jangkauan jarak menengah.
* **Bandwidth (BW)**: `125 kHz`.
* **Coding Rate (CR)**: `4/5`. Memberikan proteksi error correction dengan overhead data minimal.
* **Preamble Length**: `8 Symbols`.
* **Sync Word**: `0x12` (Menjaga agar jaringan telemetri bersifat privat).

---

## 3. Proses Serialisasi (Contoh Bahasa C untuk Autopilot/Arduino)
```c
struct __attribute__((__packed__)) TelemetryPacket {
    uint8_t magic;
    uint8_t drone_id;
    int32_t latitude;
    int32_t longitude;
    int16_t altitude;
    int16_t roll;
    int16_t pitch;
    uint16_t yaw;
    uint8_t battery;
    uint16_t speed;
    int8_t rssi;
    int16_t snr;
    uint16_t counter;
    uint16_t crc;
};
```
Fungsi dekoder di sisi bridge darat akan membaca byte stream ini, melakukan unpacking menggunakan modul `struct` Python, mengembalikan nilai ke desimal asli (misal membagi latitude dengan $10^7$), lalu mengirimkan hasilnya ke backend.
