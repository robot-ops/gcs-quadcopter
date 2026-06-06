# API Documentation - Aero-Link GCS

Layanan REST API Aero-Link dikembangkan menggunakan FastAPI. Semua komunikasi data menggunakan format JSON dan membutuhkan autentikasi Bearer Token (JWT) pada endpoint yang terproteksi.

---

## 1. Endpoint Autentikasi

### 1.1. Login Pengguna (`POST /api/v1/auth/login`)
Mengautentikasi pengguna dan mengembalikan access token JWT.
* **Content-Type**: `application/json`
* **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
  ```
* **Error Response (401 Unauthorized)**:
  ```json
  {
    "detail": "Incorrect username or password"
  }
  ```

### 1.2. Ambil Profil Pengguna (`GET /api/v1/auth/me`)
Mengambil informasi pengguna berdasarkan token JWT yang valid.
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "id": 1,
    "username": "admin",
    "email": "admin@aerolink.co",
    "role": "ADMIN"
  }
  ```

---

## 2. Endpoint Telemetri

### 2.1. Kirim Data Telemetri (`POST /api/v1/telemetry`)
Mengirimkan data telemetri baru dari UAV. Endpoint ini dipanggil secara berkala oleh Ground Station Bridge atau Companion Computer.
* **Headers**: 
  * `Authorization: Bearer <JWT_TOKEN>`
  * `Content-Type`: `application/json`
* **Request Body**:
  ```json
  {
    "drone_id": 1,
    "latitude": -6.2088,
    "longitude": 106.8456,
    "altitude": 12.5,
    "roll": 1.2,
    "pitch": -0.5,
    "yaw": 180.0,
    "battery": 95,
    "speed": 4.2,
    "rssi": -45,
    "snr": 12.4
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "id": 849,
    "drone_id": 1,
    "latitude": -6.2088,
    "longitude": 106.8456,
    "altitude": 12.5,
    "roll": 1.2,
    "pitch": -0.5,
    "yaw": 180.0,
    "battery": 95,
    "speed": 4.2,
    "rssi": -45,
    "snr": 12.4,
    "created_at": "2026-06-04T17:58:00.123456"
  }
  ```

### 2.2. Ambil Telemetri Terakhir (`GET /api/v1/telemetry/latest`)
Mengambil rekaman data telemetri terbaru dari drone tertentu.
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Query Parameters**:
  * `drone_id` (Integer, Required): ID drone prototype.
* **Response (200 OK)**:
  ```json
  {
    "id": 849,
    "drone_id": 1,
    "latitude": -6.2088,
    "longitude": 106.8456,
    "altitude": 12.5,
    "roll": 1.2,
    "pitch": -0.5,
    "yaw": 180.0,
    "battery": 95,
    "speed": 4.2,
    "rssi": -45,
    "snr": 12.4,
    "created_at": "2026-06-04T17:58:00.123456"
  }
  ```

### 2.3. Ambil Histori Telemetri (`GET /api/v1/telemetry/history`)
Mendapatkan histori telemetri. Digunakan untuk membuat grafik analisis penerbangan di dashboard.
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Query Parameters**:
  * `drone_id` (Integer, Required): ID drone prototype.
  * `limit` (Integer, Optional, Default: 100, Max: 1000): Jumlah rekaman log yang akan ditarik.
* **Response (200 OK)**:
  ```json
  [
    {
      "id": 849,
      "drone_id": 1,
      "latitude": -6.2088,
      "longitude": 106.8456,
      "altitude": 12.5,
      "roll": 1.2,
      "pitch": -0.5,
      "yaw": 180.0,
      "battery": 95,
      "speed": 4.2,
      "rssi": -45,
      "snr": 12.4,
      "created_at": "2026-06-04T17:58:00Z"
    }
  ]
  ```
