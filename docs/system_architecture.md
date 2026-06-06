# Arsitektur Sistem - Aero-Link GCS

Aero-Link adalah Ground Control Station (GCS) dan platform digital twin 3D yang dirancang khusus untuk memonitoring dan mengendalikan satu prototipe UAV Quadcopter. Sistem ini menggunakan arsitektur modular terdekopel berbasis event-driven untuk mencapai komunikasi real-time dengan latensi rendah (< 50ms).

## 1. Topologi Arsitektur Sistem
Berikut adalah gambaran umum bagaimana komponen sistem saling berinteraksi:

```mermaid
graph TD
    subgraph Wahana UAV & SITL Simulation
        A[Flight Controller / SITL] -- MAVLink Protocol (UDP/Serial) --> B[Bridge Telemetri]
        B -- LoRa / Radio Frequency --> C[LoRa Receiver / Ground Station]
    end

    subgraph Backend Core API Gateway (FastAPI)
        C -- HTTP POST + JWT Bearer --> D[FastAPI REST API]
        B -- HTTP POST + JWT Bearer --> D
        D -- SQLAlchemy ORM --> E[(Database SQLite / MySQL)]
        D -- Event Broadcast --> F[WebSocket Connection Manager]
    end

    subgraph Frontend Client (React)
        F -- WS Stream /ws/telemetry --> G[React App Client]
        G -- React Context Hub --> H[Three.js 3D Digital Twin]
        G -- React Context Hub --> I[Leaflet Map Tracking]
        G -- React Context Hub --> J[Recharts Live Analytics]
    end
```

---

## 2. Deskripsi Komponen Utama

### 2.1. Wahana & Lapisan Komunikasi Fisik
* **Flight Controller / SITL**: Pusat navigasi fisik wahana (misal Pixhawk dengan ArduPilot) atau simulator Software In The Loop (SITL). Mengirimkan status sensor sikap (attitude), posisi global, kecepatan, dan status baterai.
* **Bridge Telemetri / Ground Station Link**: Menerjemahkan paket biner MAVLink menjadi format JSON untuk dikirimkan melalui internet (jika menggunakan jaringan seluler) atau mentransmisikan data melalui modul radio transceiver LoRa.

### 2.2. API Gateway & WebSocket Server (Backend)
* **FastAPI Server**: Layanan web berkinerja tinggi yang menyediakan REST API terproteksi JWT untuk menerima data telemetri, menyimpan log penerbangan, mengelola waypoint misi, serta melayani request autentikasi operator.
* **Database (SQLAlchemy ORM)**: Menyimpan informasi pengguna, konfigurasi prototipe drone, riwayat lintasan koordinat telemetri, rencana waypoint misi, serta catatan log penerbangan.
* **WebSocket Manager**: Mengatur koneksi aktif dengan browser operator. Setiap kali data telemetri masuk melalui API REST, WebSocket Manager langsung menyebarkan (broadcast) data tersebut ke seluruh browser terhubung secara asinkron.

### 2.3. Dashboard Antarmuka Pengguna (Frontend)
* **React + Vite App**: Aplikasi satu halaman (SPA) berbasis komponen modular yang reaktif terhadap perubahan state global.
* **Telemetry Context Hub**: State manager terpusat yang mengatur koneksi WebSocket, siklus pemulihan koneksi otomatis, manipulasi waypoint, dan pemutakhiran telemetri aktif.
* **Three.js 3D Digital Twin**: Kanvas 3D WebGL yang memvisualisasikan sikap drone (roll, pitch, yaw) dan menganimasikan putaran baling-baling sesuai dengan status terbang drone (`ARMED`, `FLYING`, `DISARMED`).
* **Leaflet Map Tracking**: Peta interaktif 2D yang menggambarkan rute penerbangan drone real-time, jejak jalur lintasannya (flight trail), serta data indikator di layar (Heads-Up Display / HUD).

---

## 3. Aliran Data Telemetri (Telemetry Data Flow)
1. **Penerimaan**: Sensor pada flight controller membaca kondisi fisik wahana dan mengirimkannya ke companion computer atau modul LoRa.
2. **Koneksi Darat**: Unit bridge di darat menerima data biner tersebut, mengonversinya menjadi payload JSON terstruktur, lalu mengirimkannya ke API Backend melalui HTTP POST `/api/v1/telemetry`.
3. **Penyimpanan**: Backend memproses data tersebut, menyimpannya ke database untuk riwayat analitik, kemudian meneruskannya ke WebSocket Broadcast Manager.
4. **Visualisasi**: Browser operator menerima event telemetri dari WebSocket, memperbarui state global React, dan merender ulang model 3D drone serta posisi GPS di peta dalam waktu kurang dari 50ms.
