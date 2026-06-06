# Deployment Guide Windows - Aero-Link GCS

Panduan ini menjelaskan cara memasang, mengonfigurasi, dan menjalankan sistem Ground Control Station (GCS) Aero-Link pada sistem operasi Windows 10/11.

---

## 1. Prasyarat Sistem & Perangkat Lunak

Sebelum memulai, pastikan perangkat lunak berikut telah terinstal pada Windows Anda:
1. **Python 3.10+** (Pastikan opsi **"Add Python to PATH"** dicentang saat proses instalasi).
2. **Node.js 18+ (LTS)** (Instal beserta NPM paket manager bawaannya).
3. **Git** (Untuk mendownload atau mengelola kode sumber proyek).

---

## 2. Pemasangan & Menjalankan Backend

### Langkah 2.1. Clone Repositori & Buka Direktori
Buka **Command Prompt (CMD)** atau **PowerShell** dan masuk ke direktori backend:
```powershell
cd d:\Redesma\Dummy\uav-quadcopter\backend
```

### Langkah 2.2. Membuat Virtual Environment Python
Buat environment terisolasi untuk menghindari konflik modul Python:
```powershell
python -m venv .venv
```
Aktifkan virtual environment:
```powershell
.venv\Scripts\activate
```
*(Indikator terminal Anda akan berubah dengan awalan `(.venv)`)*.

### Langkah 2.3. Menginstal Dependensi & Konfigurasi
Instal seluruh pustaka yang diperlukan:
```powershell
pip install -r requirements.txt
```
Buat file bernama `.env` di dalam folder `backend/` untuk konfigurasi environment database dan enkripsi:
```ini
DATABASE_URL=sqlite:///./aerolink.db
SECRET_KEY=kuncirahasiapembuattokendetailjwt123
```

### Langkah 2.4. Inisialisasi Database (Seed Data)
Jalankan skrip berikut untuk membuat tabel database dan akun administrator default:
```powershell
python -m app.database.seed
```

### Langkah 2.5. Menjalankan Server Backend
Mulai server FastAPI menggunakan server web Uvicorn:
```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
* **Verifikasi**: Buka browser Anda dan akses `http://127.0.0.1:8000/docs` untuk memastikan Swagger API Docs terbuka dengan sukses.

---

## 3. Pemasangan & Menjalankan Frontend

### Langkah 3.1. Masuk ke Direktori Frontend
Buka terminal baru dan masuk ke folder `frontend`:
```powershell
cd d:\Redesma\Dummy\uav-quadcopter\frontend
```

### Langkah 3.2. Menginstal Modul NPM
Instal seluruh paket dependensi JavaScript:
```powershell
npm install
```

### Langkah 3.3. Menjalankan Aplikasi Frontend
Jalankan aplikasi React dalam mode pengembangan (development mode):
```powershell
npm run dev
```
* **Verifikasi**: Buka browser Anda di `http://localhost:5173`.
* **Login Akun**:
  * **Username**: `admin`
  * **Password**: `admin123`

---

## 4. Troubleshooting Windows
* **Error: Scripts execution policy (PowerShell)**:
  Jika PowerShell menolak mengaktifkan `.venv` dengan pesan "scripts execution is disabled", jalankan perintah ini di PowerShell dengan hak akses Administrator:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
* **Error: Port 8000 is already in use**:
  Jika port backend bertabrakan, cari PID proses yang menggunakannya dan matikan:
  ```powershell
  netstat -ano | findstr :8000
  taskkill /PID <PID_NUM> /F
  ```
