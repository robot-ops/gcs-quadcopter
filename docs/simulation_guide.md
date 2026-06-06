# Simulation Guide - Connecting ArduCopter SITL to Aero-Link GCS

This guide provides instructions on how to set up and run a Software In The Loop (SITL) simulation to test the GCS Ground Control Station and 3D Digital Twin.

## Prerequisites

1. **Python 3.10+** (for Backend and Bridge Script)
2. **Node.js 18+** (for Frontend)
3. **ArduPilot SITL / MAVProxy**
   * Can be installed in WSL2 (Windows Subsystem for Linux), a Virtual Machine, or directly on Windows.
   * Standard package install: `pip install mavproxy pymavlink`

---

## Running the Simulation Pipeline

Follow these steps in separate terminal windows:

### 1. Launch the Backend Server
First, initialize the database and start the FastAPI backend.
```bash
cd backend
python -m app.database.seed
uvicorn main:app --reload
```
* **Status check**: The backend runs at `http://127.0.0.1:8000`. You can inspect the API documentation at `http://127.0.0.1:8000/docs`.

### 2. Launch the Frontend GCS Dashboard
Start the Vite dev server for the React UI.
```bash
cd frontend
npm run dev
```
* Open your browser and navigate to `http://localhost:5173`.
* Log in with the operator credentials:
  * **Username**: `admin`
  * **Password**: `admin123`

### 3. Launch ArduCopter SITL
Start your ArduCopter SITL simulation (usually done in a WSL/Linux console).
```bash
sim_vehicle.py -v ArduCopter --console --map
```
* Note the MAVProxy forwarding address. If running inside WSL, it typically routes telemetry to the Windows host IP on port 14550 (e.g. `--out 192.168.X.X:14550`).

### 4. Run the SITL Bridge
Start the bridge script. It will connect to the SITL MAVLink output, login to the backend, and post telemetry data.
```bash
cd drone
python sitl_bridge.py
```
* Log messages will confirm connections:
  * `Successfully authenticated and obtained JWT token.`
  * `Heartbeat received! SITL is online.`
  * Periodic telemetry updates printing GPS coordinates, speed, and attitude.

### 5. Disable Web GCS Simulation Mode
1. In the Web GCS browser, go to **System Settings** in the left sidebar.
2. Uncheck **Telemetry Simulation Mode**.
3. Return to **Dashboard** or **Map Tracking**.
4. The map will auto-center to your ArduCopter's default GPS coordinates (e.g., `-35.363261, 149.165230` in Australia), and the status dot will change to green.

---

## Simulating Flight Actions

Go to your MAVProxy terminal console and execute commands to observe updates on the GCS dashboard:

### Change Flight Mode to Guided
```mavlink
mode GUIDED
```

### Arm the Motors
```mavlink
arm throttle
```
* *GCS Impact*: The 3D Digital Twin's propellers will begin spinning in standby mode and the status updates to `ARMED`.

### Takeoff to 20 Meters
```mavlink
takeoff 20
```
* *GCS Impact*: The altitude display and 3D twin elevation will increase until they reach 20m. Baling-baling (propellers) spin rapidly.

### Fly to a Coordinate (GUIDED mode)
In MAVProxy or your console:
```mavlink
guided -35.362 149.164 20
```
* *GCS Impact*: The drone will move on the Leaflet map tracking screen, leaving a red flight history path trail. The 3D Digital Twin will tilt (Pitch/Roll) relative to its speed and direction during flight.
