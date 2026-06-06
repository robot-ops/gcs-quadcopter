# Enterprise DevOps & Maintenance Handbook

This document is the operational guide for deploying, maintaining, and testing the Aero-Link Ground Control Station in staging and production environments.

---

## 1. Local & Containerized Deployment

To ensure consistent environments across local machines and target server nodes, Aero-Link uses a Docker deployment model.

### 1.1. Docker Compose Deployment (Production Configuration)
Create a `docker-compose.yml` file in the root workspace to run the frontend, backend, and database in containerized microservices:

```yaml
version: '3.8'

services:
  database:
    image: mysql:8.0
    container_name: aerolink-db
    environment:
      MYSQL_DATABASE: aerolink
      MYSQL_ROOT_PASSWORD: rootpassword
    ports:
      - "3306:3306"
    volumes:
      - db-data:/var/lib/mysql

  backend:
    build: ./backend
    container_name: aerolink-backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=mysql+pymysql://root:rootpassword@database:3306/aerolink
      - SECRET_KEY=supersecretkeyforjwttokensgeneration
    depends_on:
      - database

  frontend:
    build: ./frontend
    container_name: aerolink-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:8000

volumes:
  db-data:
```

---

## 2. Database Maintenance & Schema Migrations

The SQLAlchemy database schema is managed via **Alembic revisions**.

### 2.1. Adding New Telemetry Fields
1. Modify the schema representation in `backend/app/models/telemetry.py`.
2. Generate an auto-migration script:
   ```bash
   alembic revision --autogenerate -m "Add custom telemetry data fields"
   ```
3. Verify the generated script in `backend/alembic/versions/`.
4. Apply the database upgrade:
   ```bash
   alembic upgrade head
   ```

### 2.2. Rolling Back Database Migration
To revert the last applied migration:
```bash
alembic downgrade -1
```

---

## 3. System Logging, Monitoring & Observability

### 3.1. FastAPI Logging Pipeline
FastAPI handles logging outputs internally using Python's standard `logging` library. In production, logs are formatted as JSON and redirected to `stdout`/`stderr` for collection by agents (e.g. Promtail, fluentd).
Configuration is managed in `backend/app/core/config.py`.

### 3.2. Monitoring Telemetry Health
Ensure the following key metrics are mapped in Grafana:
* **`websocket_active_connections`**: Gauge counting currently connected GCS clients.
* **`telemetry_packets_received_total`**: Counter measuring ingestion flow from the SITL bridge.
* **`api_request_duration_seconds`**: Histogram charting HTTP POST latency metrics on the `/api/v1/telemetry` endpoint.

---

## 4. Testing & Verification Suites

Continuous Integration validation must be run prior to merging code updates.

### 4.1. Backend Unit & API Testing (Pytest)
Run the automated test suites using `pytest`:
```bash
cd backend
pytest -v --cov=app tests/
```

### 4.2. Frontend Build Verification
Perform clean asset bundling checks and code syntax inspection:
```bash
cd frontend
# Check for lint errors
npm run lint
# Verify production build compilation
npm run build
```

---

## 5. Disaster Recovery & Troubleshooting

### 5.1. Database Backup Command (Cron Schedule)
Schedule automated nightly database dumps:
```bash
# SQLite Backup
sqlite3 backend/aerolink.db ".backup 'backups/aerolink_backup_$(date +%F).db'"

# MySQL Backup (when running containerized)
docker exec aerolink-db mysqldump -u root -prootpassword aerolink > backups/backup_$(date +%F).sql
```

### 5.2. Telemetry Bridge Diagnostics
If the bridge fails to post telemetry, execute these validation checks:
1. Verify the binding interface using netstat:
   ```bash
   netstat -ano | findstr 14550
   ```
2. Verify that FastAPI server is listening on port 8000:
   ```bash
   curl -I http://127.0.0.1:8000/
   ```
3. Test JWT authentication manually:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin", "password":"admin123"}'
   ```
