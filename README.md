# Aero-Link GCS — Digital Twin Ground Control Station

> **Versi**: v1.0.0 · **Status**: Single-Drone Prototype · **Klasifikasi**: Proprietary / Internal Development

Aero-Link adalah Ground Control Station (GCS) berbasis web generasi berikutnya dengan kemampuan visualisasi Digital Twin 3D secara real-time. Platform ini dirancang untuk memonitoring, mengendalikan, dan menganalisis data penerbangan satu prototipe UAV Quadcopter menggunakan aliran telemetri live dari hardware ArduPilot atau ArduCopter SITL.

---

## Fitur Utama

| Fitur | Deskripsi |
| :--- | :--- |
| 🛸 **3D Digital Twin** | Model 3D interaktif di WebGL (Three.js) yang bergerak sinkron mengikuti Roll, Pitch, dan Yaw dari wahana. |
| 🗺️ **Live Map Tracking** | Peta Leaflet interaktif menampilkan koordinat GPS drone, jejak lintasan penerbangan, dan HUD telemetri. |
| 📡 **Real-time Telemetry** | Grafik analitik live untuk kecepatan, ketinggian, level baterai, dan kualitas sinyal LoRa. |
| 🎮 **GCS Command Console** | Kontrol penerbangan langsung (ARM, DISARM, TAKEOFF, LAND) melalui saluran WebSocket. |
| ✈️ **Mission Planner** | Antarmuka klik-untuk-tambah waypoint pada peta dengan manajemen altitude dan urutan penerbangan. |
| 🔌 **SITL & Hardware** | Terintegrasi dengan ArduCopter SITL dan hardware Pixhawk melalui protokol MAVLink dan radio LoRa. |

---

## Struktur Direktori

```text
uav-quadcopter/
├── .github/workflows/  # CI/CD GitHub Actions (Deploy otomatis ke VPS)
├── backend/            # FastAPI Server, ORM Models, JWT Auth, WebSocket Manager
├── frontend/           # React + Vite GCS Dashboard, Three.js Twin, Leaflet Maps
├── drone/              # Script bridge MAVLink-to-API untuk SITL dan hardware fisik
│   ├── pixhawk_bridge.py # Bridge Pixhawk 2.4.8 (SiK 433MHz Radio, Waypoints, Live Terminal)
│   └── sitl_bridge.py    # Bridge ArduCopter SITL MAVLink (Local/UDP)
├── docs/               # Dokumentasi teknis lengkap proyek
│   ├── PRD.md                          # Product Requirement Document (Enterprise)
│   ├── system_architecture.md          # Arsitektur sistem & diagram aliran data
│   ├── database_design.md              # Skema ERD, tabel, dan indeks database
│   ├── api_documentation.md            # REST API endpoint, request & response
│   ├── websocket_documentation.md      # WebSocket events, struktur payload
│   ├── lora_protocol.md                # Protokol biner LoRa / SiK Radio, parameter RF
│   ├── flight_controller_integration.md # Integrasi MAVLink, Pixhawk hardware & telemetry radio
│   ├── simulation_guide.md             # Panduan lengkap simulasi SITL
│   ├── maintenance_guide.md            # DevOps, CI/CD, DB migration, monitoring
│   ├── deployment_windows.md           # Panduan deployment di Windows
│   └── deployment_linux.md             # Panduan deployment di Linux (VPS Ubuntu + Nginx)
└── README.md
```

---

## Quick Start

### 1. Backend Setup (FastAPI)
```bash
cd backend

# Buat dan aktifkan virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Linux/macOS

# Instalasi dependensi
pip install -r requirements.txt

# Inisialisasi database dan seed data
python -m app.database.seed

# Jalankan server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Verifikasi: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup (React)
```bash
cd frontend
npm install
npm run dev
```
Akses: `http://localhost:5173` — Login: `admin` / `admin123`

### 3. Jembatan Telemetri Drone (Bridge)

#### A. Hardware Fisik — Pixhawk 2.4.8 (SiK Radio 433MHz)
Hubungkan modul ground 433MHz Telemetry Radio ke port USB laptop/GCS:
```bash
cd drone
pip install pymavlink requests websockets

# Menjalankan bridge ke backend lokal
python pixhawk_bridge.py --port COM8 --baud 57600 --url http://127.0.0.1:8000

# Atau menghubungkan ke server VPS produksi
python pixhawk_bridge.py --port COM8 --baud 57600 --url http://<IP_VPS_ANDA>
```
* Mendukung streaming telemetri penuh (Attitude, GPS, VFR HUD, Baterai, RSSI/SNR asli).
* Sinkronisasi upload waypoint interaktif langsung dari Web GCS ke EEPROM Pixhawk.
* Logging terminal live dan penyimpanan sesi otomatis ke database Flight Logs saat drone DISARM.

#### B. Simulasi SITL (ArduCopter)
```bash
# Di terminal ArduPilot/WSL
sim_vehicle.py -v ArduCopter --console --map

# Di terminal Windows/Linux — jalankan bridge telemetri SITL
cd drone
pip install pymavlink requests
python sitl_bridge.py
```
Kemudian matikan **Simulation Mode** di halaman **System Settings** GCS.

---

## Indeks Dokumentasi Teknis

| Dokumen | Deskripsi |
| :--- | :--- |
| [PRD.md](docs/PRD.md) | Kebutuhan produk, epics, SLA, & roadmap pengembangan |
| [system_architecture.md](docs/system_architecture.md) | Topologi sistem, diagram blok, & aliran data telemetri |
| [database_design.md](docs/database_design.md) | ERD lengkap, skema kolom, & strategi indexing |
| [api_documentation.md](docs/api_documentation.md) | REST API endpoint, format request/response JSON |
| [websocket_documentation.md](docs/websocket_documentation.md) | Event WebSocket, payload format, & auto-reconnect logic |
| [lora_protocol.md](docs/lora_protocol.md) | Struktur biner LoRa 29-byte, parameter RF & C struct |
| [flight_controller_integration.md](docs/flight_controller_integration.md) | MAVLink message ID, wiring Pixhawk, & kode Python bridge |
| [simulation_guide.md](docs/simulation_guide.md) | Tutorial penerbangan SITL step-by-step |
| [maintenance_guide.md](docs/maintenance_guide.md) | CI/CD GitHub Actions, DB migration, monitoring & disaster recovery |
| [deployment_windows.md](docs/deployment_windows.md) | Setup lengkap deployment di Windows 10/11 |
| [deployment_linux.md](docs/deployment_linux.md) | Deployment produksi di VPS Ubuntu dengan Systemd, Nginx & CI/CD |

---

## Teknologi yang Digunakan

| Layer | Teknologi |
| :--- | :--- |
| **Frontend** | React 18, Vite, Three.js, Leaflet.js, Recharts, Lucide Icons |
| **Backend** | FastAPI, SQLAlchemy, Alembic, Uvicorn, PyJWT, Bcrypt |
| **Database** | SQLite (development) / MySQL (production) |
| **Komunikasi** | WebSocket, MAVLink Protocol, LoRa Radio (SX1276) |
| **Simulasi** | ArduCopter SITL, MAVProxy, PyMAVLink |
