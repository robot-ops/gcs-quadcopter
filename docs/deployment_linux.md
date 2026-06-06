# Deployment Guide Linux - Aero-Link GCS

Panduan ini menjelaskan cara melakukan deployment produksi untuk sistem GCS Aero-Link di lingkungan Linux (distribusi Ubuntu 20.04/22.04 LTS) menggunakan **Systemd Service** dan **Nginx** sebagai reverse proxy.

---

## 1. Prasyarat Sistem
Instal seluruh paket dependensi sistem operasi yang diperlukan:
```bash
sudo apt update
sudo apt install -y python3-pip python3-venv nodejs npm nginx git
```

---

## 2. Pemasangan & Konfigurasi Backend

1. Buat folder aplikasi di `/var/www/uav-quadcopter` dan ubah hak akses kepemilikan folder:
   ```bash
   sudo mkdir -p /var/www/uav-quadcopter
   sudo chown -R $USER:$USER /var/www/uav-quadcopter
   cd /var/www/uav-quadcopter
   ```
2. Download kode sumber proyek (Git clone) ke direktori tersebut.
3. Masuk ke folder backend, buat virtual environment, instal dependensi, dan lakukan database seeding:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   python -m app.database.seed
   ```
4. Buat file Systemd service agar server FastAPI berjalan di background secara otomatis dan pulih jika terjadi crash:
   ```bash
   sudo nano /etc/systemd/system/aerolink-backend.service
   ```
   *Masukkan konfigurasi berikut:*
   ```ini
   [Unit]
   Description=Aero-Link FastAPI Backend Service
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/var/www/uav-quadcopter/backend
   ExecStart=/var/www/uav-quadcopter/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
   Restart=always
   Environment=DATABASE_URL=sqlite:////var/www/uav-quadcopter/backend/aerolink.db SECRET_KEY=kuncirahasiapembuattokendetailjwt123

   [Install]
   WantedBy=multi-user.target
   ```
5. Reload daemon systemd, aktifkan auto-start, dan nyalakan service backend:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable aerolink-backend
   sudo systemctl start aerolink-backend
   ```

---

## 3. Kompilasi Frontend (Production Build)

1. Masuk ke folder frontend:
   ```bash
   cd /var/www/uav-quadcopter/frontend
   ```
2. Instal paket dependensi NPM:
   ```bash
   npm install
   ```
3. Lakukan build kompilasi aset frontend statik untuk performa maksimal di sisi klien:
   ```bash
   npm run build
   ```
   *Ini akan menghasilkan file HTML/CSS/JS statik yang siap disajikan oleh Nginx di folder `/var/www/uav-quadcopter/frontend/dist`*.

---

## 4. Konfigurasi Nginx Reverse Proxy & WebSocket Upstream

1. Buat file konfigurasi virtual host baru untuk Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/aerolink
   ```
   *Masukkan konfigurasi routing berikut:*
   ```nginx
   server {
       listen 80;
       server_name localhost;

       # Mengarahkan request frontend ke berkas kompilasi statik React
       location / {
           root /var/www/uav-quadcopter/frontend/dist;
           index index.html;
           try_files $uri $uri/ /index.html;
       }

       # Mengarahkan request API REST ke backend FastAPI (uvicorn)
       location /api {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       # Mengarahkan koneksi WebSocket Telemetri secara persisten
       location /ws {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```
2. Aktifkan konfigurasi Nginx dan hapus berkas konfigurasi default:
   ```bash
   sudo ln -s /etc/nginx/sites-available/aerolink /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   ```
3. Lakukan tes validasi sintaks konfigurasi Nginx dan jalankan ulang web server:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```
4. Sistem sekarang online. Buka browser dan akses alamat IP server Anda (`http://<ip_address_server>`) untuk mengoperasikan GCS Aero-Link.
