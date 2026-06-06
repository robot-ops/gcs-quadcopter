import time
import math
import requests
from pymavlink import mavutil

# --- CONFIGURATION ---
SITL_CONNECTION = "udpin:0.0.0.0:14550"  # Listen on all interfaces (WSL compatible)
BACKEND_URL = "http://127.0.0.1:8000"
USERNAME = "admin"
PASSWORD = "admin123"
DRONE_ID = 1  # Standard drone ID seeded in DB

def get_jwt_token():
    print(f"Authenticating with backend at {BACKEND_URL}...")
    try:
        response = requests.post(f"{BACKEND_URL}/api/v1/auth/login", json={
            "username": USERNAME,
            "password": PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            print("Successfully authenticated and obtained JWT token.")
            return token
        else:
            print(f"Authentication failed with status: {response.status_code}, response: {response.text}")
            return None
    except Exception as e:
        print(f"Error connecting to backend: {e}")
        return None

def main():
    token = get_jwt_token()
    if not token:
        print("Cannot start bridge without backend authentication.")
        return

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print(f"Connecting to ArduCopter SITL on {SITL_CONNECTION}...")
    # Connect to MAVLink
    master = mavutil.mavlink_connection(SITL_CONNECTION)
    
    # Wait for heartbeat to ensure connection
    print("Waiting for heartbeat...")
    master.wait_heartbeat()
    print("Heartbeat received! SITL is online.")

    # In-memory values to bundle and send
    telemetry_data = {
        "drone_id": DRONE_ID,
        "latitude": 0.0,
        "longitude": 0.0,
        "altitude": 0.0,
        "roll": 0.0,
        "pitch": 0.0,
        "yaw": 0.0,
        "battery": 100.0,
        "speed": 0.0,
        "rssi": -30,
        "snr": 15.0
    }

    last_send_time = 0
    send_interval = 0.5  # Send telemetry every 500ms

    try:
        while True:
            # Grab all available MAVLink messages
            msg = master.recv_match(blocking=False)
            if msg is not None:
                msg_type = msg.get_type()
                
                # GPS and Position
                if msg_type == 'GLOBAL_POSITION_INT':
                    telemetry_data["latitude"] = msg.lat / 1e7
                    telemetry_data["longitude"] = msg.lon / 1e7
                    telemetry_data["altitude"] = msg.relative_alt / 1000.0  # mm to meters
                
                # Attitude (Roll, Pitch, Yaw)
                elif msg_type == 'ATTITUDE':
                    # Convert radians from MAVLink to degrees
                    telemetry_data["roll"] = round(math.degrees(msg.roll), 2)
                    telemetry_data["pitch"] = round(math.degrees(msg.pitch), 2)
                    telemetry_data["yaw"] = round(math.degrees(msg.yaw), 2)
                
                # Speed (HUD)
                elif msg_type == 'VFR_HUD':
                    telemetry_data["speed"] = round(msg.groundspeed, 2)
                
                # Battery / Sys status
                elif msg_type == 'SYS_STATUS':
                    # remaining battery percentage
                    battery_remaining = msg.battery_remaining
                    if battery_remaining != -1:
                        telemetry_data["battery"] = battery_remaining

            # Periodically post the telemetry data to the backend
            current_time = time.time()
            if current_time - last_send_time >= send_interval:
                # Only post if we have valid coordinates (i.e. SITL has acquired GPS lock)
                if telemetry_data["latitude"] != 0.0:
                    try:
                        response = requests.post(
                            f"{BACKEND_URL}/api/v1/telemetry",
                            json=telemetry_data,
                            headers=headers,
                            timeout=0.2
                        )
                        if response.status_code == 200:
                            print(f"Posted telemetry -> Lat: {telemetry_data['latitude']:.5f}, "
                                  f"Lng: {telemetry_data['longitude']:.5f}, Alt: {telemetry_data['altitude']:.1f}m, "
                                  f"Roll: {telemetry_data['roll']}°, Pitch: {telemetry_data['pitch']}°, "
                                  f"Yaw: {telemetry_data['yaw']}°, Battery: {telemetry_data['battery']}%")
                        elif response.status_code == 401:
                            print("JWT Token expired! Re-authenticating...")
                            token = get_jwt_token()
                            if token:
                                headers["Authorization"] = f"Bearer {token}"
                    except requests.exceptions.RequestException:
                        print("Failed to contact FastAPI backend server. Is it running?")
                else:
                    print("Waiting for GPS lock on ArduCopter SITL...")
                
                last_send_time = current_time
            
            time.sleep(0.01)

    except KeyboardInterrupt:
        print("\nSITL Bridge stopped.")

if __name__ == "__main__":
    main()
