# Enterprise Product Requirement Document (PRD)

## Document Control
* **Project Name**: Aero-Link Digital Twin Ground Control Station (GCS)
* **Status**: Production-Ready / Single-Drone Optimized
* **Target Release Version**: v1.0.0
* **Classification**: Proprietary / Internal Development

---

## 1. Product Vision & Strategy
Aero-Link is an enterprise-grade Ground Control Station (GCS) and real-time 3D Digital Twin visualization platform designed to monitor, track, and command single-prototype UAV Quadcopters. The platform bridges the gap between hardware autopilot firmware (via MAVLink) and web-based operator interfaces. It enables low-latency visual flight telemetry, interactive mission planning, and data analytics on a unified, high-performance web dashboard.

---

## 2. User Personas

### 2.1. Lead UAV Systems Integrator
* **Goal**: Validate custom flight controllers, sensor inputs (IMU, GPS, LoRa), and attitude adjustments in real-time.
* **Pain Points**: Hard-to-read command-line streams or complex desktop GCS software that lacks real-time 3D orientation visualization.

### 2.2. GCS Flight Operator
* **Goal**: Run pre-planned waypoint missions, issue critical safety commands (ARM/DISARM, LAND, TAKEOFF), and monitor battery and link quality.
* **Pain Points**: High telemetry lag, lack of clear geospatial path history, and non-intuitive artificial horizon indicators.

### 2.3. DevOps / Maintenance Engineer
* **Goal**: Seamlessly deploy, monitor, and scale GCS nodes in containerized environments with standard SQLite/MySQL storage backends.
* **Pain Points**: Monolithic GCS solutions that are hard to run in standard cloud/VM infrastructure.

---

## 3. Product Scope & Single-Drone Architecture
To optimize telemetry parsing and rendering loops for rapid prototype validation, all multi-drone fleet selectors and routing structures have been removed. The system is designed to lock on **one active prototype** (`Quadcopter X-1` with default `drone_id: 1`). This optimization guarantees peak WebGL and Leaflet rendering performance on standard workstation hardware.

---

## 4. Epic & Functional Specifications

### Epic 1: High-Fidelity 3D Digital Twin (Attitude Indicator)
* **Real-time Orientation Sync**: Converts incoming Roll, Pitch, and Yaw telemetry updates into Euler Radians for a WebGL-rendered 3D model. Rotation transitions must be linear and smooth.
* **Procedural Backup Rendering**: If the local GLB mesh asset `/assets/quadcopter.glb` fails to load, a procedural fallback drone model is generated instantly using high-detail carbon-fiber and zinc grey geometric meshes. Propellers are color-coded (amber front, zinc rear) to indicate heading direction.
* **Rotor Animations**: Propellers must spin dynamically relative to the `droneState`:
  * `DISARMED`: 0 RPM
  * `ARMED`: Low-speed standby (0.08 rad/frame)
  * `TAKEOFF` / `FLYING`: High-speed throttle (0.45 rad/frame)
  * `LANDING`: Gradually decelerating spin (0.28 rad/frame)
* **Dual Viewport Toggle**: Operators can toggle the left panel view between the interactive **3D Twin** and a standard **2D PFD (Primary Flight Display)** artificial horizon.

### Epic 2: Real-time Leaflet Map Tracking
* **Live Spatial Mapping**: Renders the UAV position on a Leaflet map. The drone icon must dynamically rotate matching the current telemetry heading (Yaw).
* **Dynamic Flight Trail**: Draws a path polyline showing flight history where altitude is above `0.5` meters.
* **Layer Theme Selectors**: Supports map layer hot-swapping (Light, Dark, and Streets) without triggering full page reloads.
* **Active HUD Panel**: Overlay displaying:
  * GPS coordinates (Latitude & Longitude).
  * Flight dynamics: Altitude (m) and Ground Speed (m/s).
  * LoRa link diagnostics: RSSI (dBm) and SNR (dB).
  * Interactive battery percentage indicator with alert status colors (amber/red) when battery level drops below 20%.

### Epic 3: GCS Flight Commands & Mission Planner
* **Command Console**: Enables operators to transmit low-latency commands (`ARM`, `DISARM`, `TAKEOFF`, `LAND`) over a WebSocket gateway.
* **Interactive Waypoint Editing**: Clicking on the map plots waypoints, displaying sequence number, latitude, longitude, and an editable altitude field.
* **Mission Clearing**: One-click deletion to clear the current waypoint array or remove individual waypoints dynamically.

### Epic 4: Analytics, Logs, & Simulation Modes
* **Avionics & Signal Visualization**: Real-time line charts showing data trends for altitude, ground speed, attitude variations, battery drain, and LoRa link quality.
* **Telemetry Data Log**: A chronological table displaying every parsed telemetry broadcast packet, with export-ready parameters.
* **Physics-based Internal Simulator**: A toggleable frontend telemetry simulation loop generating realistic acceleration, lift, and coordinate progression along planned waypoints for offline testing.

---

## 5. Non-Functional Requirements (NFR)

### 5.1. Performance & Latency
* **Telemetry Throughput**: The backend must process and broadcast incoming telemetry payloads up to a rate of 10Hz (100ms updates) without database locking.
* **WebSocket Latency**: GCS dashboard must render updates within `< 50ms` of packet receipt.
* **Frame Rate**: The WebGL digital twin canvas must render at a stable `60 FPS` on computers equipped with standard hardware acceleration.

### 5.2. Security, Authenticity & Data Integrity
* **Access Control**: REST API endpoints (including telemetry updates and commands) require a valid JWT OAuth2 Bearer token in HTTP headers.
* **Fault Tolerance**: WebSocket manager must safely disconnect inactive clients and prune broken connections without degrading server execution loops.

---

## 6. SLA & Performance Benchmarks

| Metric | Target | Warning Threshold | Critical Action |
| :--- | :--- | :--- | :--- |
| **Telemetry ingestion rate** | 500ms | > 1000ms | Re-initiate connection / network check |
| **WebSocket ping latency** | < 30ms | > 100ms | Switch to backup backup server node |
| **WebGL rendering rate** | 60 FPS | < 30 FPS | Disable shadows / simplify mesh details |
| **REST API response time** | < 100ms | > 500ms | Optimize database query index |
