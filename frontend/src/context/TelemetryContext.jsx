import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getLatestTelemetry, getTelemetryHistory, uploadMissionApi, getLatestMissionApi, getFlightLogsApi, deleteFlightLogApi } from "../api/telemetryApi";

const TelemetryContext = createContext(null);

const DEFAULT_SETTINGS = {
  wsUrl: import.meta.env.VITE_WS_URL || (import.meta.env.DEV
    ? "ws://127.0.0.1:8000/ws/telemetry"
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/telemetry`),
  batteryThreshold: 20,
  rssiThreshold: -90,
  rollOffset: 0.0,
  pitchOffset: 0.0
};

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem("aerolink_gcs_settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function formatDbFlightLog(log) {
  const start = new Date(log.start_time);
  const end = new Date(log.end_time);
  const diffSec = Math.max(1, Math.round((end - start) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return {
    id: log.id,
    date: start.toISOString().split("T")[0],
    duration: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
    max_alt: `${(log.max_altitude || 0).toFixed(1)} m`,
    avg_speed: `${(log.avg_speed || 0).toFixed(1)} m/s`,
    status: "Completed"
  };
}

const DEFAULT_TELEMETRY = {
  drone_id: 1,
  latitude: -6.2088,
  longitude: 106.8456,
  altitude: 0.0,
  roll: 0.0,
  pitch: 0.0,
  yaw: 0.0,
  battery: 100,
  speed: 0.0,
  rssi: -45,
  snr: 15.4,
  created_at: new Date().toISOString()
};

export function TelemetryProvider({ children }) {
  const [currentTelemetry, setCurrentTelemetry] = useState(DEFAULT_TELEMETRY);
  const [telemetryHistory, setTelemetryHistory] = useState([DEFAULT_TELEMETRY]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [droneState, setDroneState] = useState("DISARMED"); // DISARMED, ARMED, TAKEOFF, FLYING, LANDING
  const [activeDroneId, setActiveDroneId] = useState(1);
  const [useSimulation, setUseSimulation] = useState(true);
  const [waypoints, setWaypoints] = useState([
    { lat: -6.2088, lng: 106.8456, seq: 1, alt: 15.0 },
    { lat: -6.2078, lng: 106.8466, seq: 2, alt: 15.0 },
    { lat: -6.2068, lng: 106.8456, seq: 3, alt: 15.0 },
    { lat: -6.2078, lng: 106.8446, seq: 4, alt: 15.0 }
  ]);
  const [targetWaypointIndex, setTargetWaypointIndex] = useState(0);
  const [settings, setSettings] = useState(loadSavedSettings);
  const socketRef = useRef(null);
  const simulatedTimerRef = useRef(null);

  // Flight log collection for the flight log page
  const [flightLogs, setFlightLogs] = useState([]);
  const [eventLogs, setEventLogs] = useState([
    { time: new Date().toLocaleTimeString(), text: "GCS Initialized. Waiting for telemetry stream...", type: "system" }
  ]);

  const addEventLog = (text, type = "info") => {
    const timeStr = new Date().toLocaleTimeString();
    setEventLogs(prev => {
      if (prev[0]?.text === text) return prev;
      return [{ time: timeStr, text, type }, ...prev.slice(0, 29)];
    });
  };

  // Fetch initial telemetry and history when switching to live mode
  useEffect(() => {
    if (useSimulation) return;

    const fetchInitialData = async () => {
      try {
        const latest = await getLatestTelemetry(activeDroneId);
        if (latest) {
          setCurrentTelemetry(latest);
        }
        const history = await getTelemetryHistory(activeDroneId, 40);
        if (history && history.length > 0) {
          setTelemetryHistory(history.reverse());
        }
        const savedMission = await getLatestMissionApi(activeDroneId);
        if (savedMission && savedMission.waypoints && savedMission.waypoints.length > 0) {
          setWaypoints(savedMission.waypoints.map((w, i) => ({
            seq: w.seq || i + 1,
            lat: w.latitude,
            lng: w.longitude,
            alt: w.altitude
          })));
        }
        const logs = await getFlightLogsApi(activeDroneId, 50);
        if (logs && Array.isArray(logs)) {
          setFlightLogs(logs.map(formatDbFlightLog));
        }
      } catch (err) {
        console.error("Failed to fetch initial telemetry data:", err);
      }
    };

    fetchInitialData();
  }, [useSimulation, activeDroneId]);

  // Handle live WebSocket connection
  useEffect(() => {
    let isDisposed = false;
    let reconnectTimer = null;
    const wsUrl = settings.wsUrl || DEFAULT_SETTINGS.wsUrl;

    function connect() {
      if (isDisposed || useSimulation) return;

      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (isDisposed) { socket.close(); return; }
          setIsSocketConnected(true);
          console.log("WebSocket telemetry connected.");
        };

        socket.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === "telemetry" && msg.data) {
              const tel = {
                ...msg.data,
                roll: parseFloat(((msg.data.roll || 0) + (settings.rollOffset || 0)).toFixed(1)),
                pitch: parseFloat(((msg.data.pitch || 0) + (settings.pitchOffset || 0)).toFixed(1)),
                created_at: msg.data.created_at || new Date().toISOString()
              };
              setCurrentTelemetry(tel);
              setTelemetryHistory(prev => {
                const next = [...prev, tel];
                return next.slice(-60);
              });
            } else if (msg.event === "event_log" && msg.data) {
              const { text, type, drone_state } = msg.data;
              if (text) {
                addEventLog(text, type || "info");
                if (text.includes("Flight session saved")) {
                  getFlightLogsApi(activeDroneId, 50)
                    .then(logs => logs && setFlightLogs(logs.map(formatDbFlightLog)))
                    .catch(() => {});
                }
              }
              if (drone_state) {
                setDroneState(drone_state);
              }
            } else if (msg.event === "command" && msg.data) {
              const cmd = msg.data.command;
              addEventLog(`[UPLINK] Command sent to UAV: ${cmd}`, "system");
              if (cmd === "ARM") {
                setDroneState("ARMED");
              } else if (cmd === "DISARM") {
                setDroneState("DISARMED");
              } else if (cmd === "TAKEOFF") {
                setDroneState("TAKEOFF");
              } else if (cmd === "AUTO" || cmd === "START_MISSION") {
                setDroneState("FLYING");
              } else if (cmd === "LAND" || cmd === "RTL") {
                setDroneState("LANDING");
              }
            }
          } catch (err) {
            console.error("Error parsing telemetry message:", err);
          }
        };

        socket.onclose = () => {
          setIsSocketConnected(false);
          if (!isDisposed) {
            console.log("WebSocket telemetry disconnected. Reconnecting in 3s...");
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        socket.onerror = (err) => {
          console.error("WebSocket telemetry error:", err);
          socket.close();
        };
      } catch (e) {
        console.error("WebSocket setup error:", e);
      }
    }

    if (!useSimulation) {
      connect();
    } else {
      setIsSocketConnected(false);
    }

    return () => {
      isDisposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [useSimulation, settings.wsUrl, settings.rollOffset, settings.pitchOffset, activeDroneId]);



  // Simulator Loop
  useEffect(() => {
    if (!useSimulation) {
      if (simulatedTimerRef.current) {
        clearInterval(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
      return;
    }

    let lat = DEFAULT_TELEMETRY.latitude;
    let lng = DEFAULT_TELEMETRY.longitude;
    let alt = 0.0;
    let battery = 100;
    let speed = 0.0;
    let angle = 0;

    simulatedTimerRef.current = setInterval(() => {
      // Simulate according to drone state
      if (droneState === "DISARMED") {
        alt = Math.max(0, alt - 1.0);
        speed = Math.max(0, speed - 0.5);
        if (battery < 100) battery = Math.min(100, battery + 0.1); // charging on ground
      } else if (droneState === "ARMED") {
        alt = Math.max(0, alt - 1.0);
        speed = 0.0;
        battery = Math.max(0, battery - 0.005);
      } else if (droneState === "TAKEOFF") {
        speed = 1.2;
        const firstWpAlt = waypoints[0]?.alt || 15.0;
        alt = Math.min(firstWpAlt, alt + 0.8);
        battery = Math.max(0, battery - 0.05);
        if (alt >= firstWpAlt) {
          setDroneState("FLYING");
        }
      } else if (droneState === "FLYING") {
        battery = Math.max(0, battery - 0.03);
        if (battery <= 10) {
          setDroneState("LANDING");
        }
        
        // Fly towards target waypoint
        const target = waypoints[targetWaypointIndex];
        if (target) {
          const targetAlt = target.alt || 15.0;
          if (alt < targetAlt) alt = Math.min(targetAlt, alt + 0.5);
          else if (alt > targetAlt) alt = Math.max(targetAlt, alt - 0.5);

          const dLat = target.lat - lat;
          const dLng = target.lng - lng;
          const distance = Math.sqrt(dLat * dLat + dLng * dLng);
          
          if (distance < 0.0002) {
            // Target reached, switch to next waypoint
            setTargetWaypointIndex(prev => (prev + 1) % waypoints.length);
          } else {
            speed = 5.4 + Math.sin(angle) * 0.5;
            // Heading angle to target
            const heading = Math.atan2(dLng, dLat);
            const moveStep = 0.0001; // simulated step
            lat += Math.cos(heading) * moveStep;
            lng += Math.sin(heading) * moveStep;
          }
        } else {
          alt = 15.0 + Math.sin(angle * 2) * 1.5;
        }
      } else if (droneState === "LANDING") {
        speed = Math.max(1.0, speed - 0.4);
        alt = Math.max(0.0, alt - 0.5);
        battery = Math.max(0, battery - 0.02);
        if (alt <= 0.0) {
          alt = 0.0;
          setDroneState("DISARMED");
        }
      }

      angle += 0.05;
      const roll = droneState === "FLYING" ? Math.sin(angle) * 12.0 : 0.0;
      const pitch = droneState === "FLYING" ? Math.cos(angle * 1.5) * 8.0 : 0.0;
      const yaw = (angle * 20.0) % 360;

      const simTelemetry = {
        drone_id: activeDroneId,
        latitude: lat,
        longitude: lng,
        altitude: parseFloat(alt.toFixed(2)),
        roll: parseFloat(roll.toFixed(1)),
        pitch: parseFloat(pitch.toFixed(1)),
        yaw: parseFloat(yaw.toFixed(1)),
        battery: Math.round(battery),
        speed: parseFloat(speed.toFixed(2)),
        rssi: Math.round(-45 + Math.sin(angle) * 5 - (droneState === "FLYING" ? 10 : 0)),
        snr: parseFloat((15.4 + Math.cos(angle) * 2).toFixed(1)),
        created_at: new Date().toISOString()
      };

      setCurrentTelemetry(simTelemetry);
      setTelemetryHistory(prev => {
        const next = [...prev, simTelemetry];
        return next.slice(-40);
      });
    }, 500);

    return () => {
      if (simulatedTimerRef.current) {
        clearInterval(simulatedTimerRef.current);
      }
    };
  }, [droneState, useSimulation, activeDroneId, waypoints, targetWaypointIndex]);

  const commandDrone = (cmd) => {
    console.log(`Drone command sent: ${cmd}`);
    addEventLog(`[GCS] Transmitting command: ${cmd}...`, "system");
    if (useSimulation) {
      if (cmd === "ARM") {
        setDroneState("ARMED");
      } else if (cmd === "DISARM") {
        setDroneState("DISARMED");
      } else if (cmd === "TAKEOFF" || cmd === "AUTO" || cmd === "START_MISSION") {
        if (droneState === "ARMED" || droneState === "DISARMED") {
          setDroneState("TAKEOFF");
        }
      } else if (cmd === "LAND" || cmd === "RTL") {
        if (droneState === "FLYING" || droneState === "TAKEOFF") {
          setDroneState("LANDING");
        }
      }
    } else {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          event: "command",
          data: { command: cmd }
        }));
      } else {
        console.warn("WebSocket not connected. Cannot send command.");
      }
    }
  };

  const addWaypoint = (lat, lng) => {
    setWaypoints(prev => [
      ...prev,
      { lat, lng, seq: prev.length + 1, alt: 15.0 }
    ]);
  };

  const removeWaypoint = (index) => {
    setWaypoints(prev => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((wp, idx) => ({ ...wp, seq: idx + 1 }));
    });
    setTargetWaypointIndex(prev => {
      if (waypoints.length <= 1) return 0;
      return prev % (waypoints.length - 1);
    });
  };

  const updateWaypointAltitude = (index, alt) => {
    setWaypoints(prev => prev.map((wp, idx) => idx === index ? { ...wp, alt } : wp));
  };

  const clearWaypoints = () => {
    setWaypoints([]);
    setTargetWaypointIndex(0);
  };

  const uploadMissionToDrone = async () => {
    if (waypoints.length === 0) {
      addEventLog("[GCS] Cannot upload empty waypoint list.", "warn");
      return false;
    }
    addEventLog(`[GCS] Saving & uploading ${waypoints.length} waypoints to Pixhawk...`, "system");

    if (useSimulation) {
      addEventLog(`[SIM] ${waypoints.length} waypoints loaded into simulator queue.`, "info");
      return true;
    }

    try {
      await uploadMissionApi(activeDroneId, waypoints);
      return true;
    } catch (err) {
      console.error("REST mission upload failed, falling back to direct WebSocket:", err);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          event: "upload_mission",
          data: { drone_id: activeDroneId, waypoints }
        }));
        return true;
      }
      addEventLog("[GCS] Failed to upload mission: Backend/WebSocket unreachable.", "warn");
      return false;
    }
  };

  const updateSettings = (newPartial) => {
    setSettings(prev => {
      const next = { ...prev, ...newPartial };
      try {
        localStorage.setItem("aerolink_gcs_settings", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const deleteFlightLog = async (id) => {
    setFlightLogs(prev => prev.filter(log => log.id !== id));
    if (!useSimulation) {
      try {
        await deleteFlightLogApi(id);
      } catch (err) {
        console.error("Failed to delete flight log from DB:", err);
      }
    }
  };

  return (
    <TelemetryContext.Provider value={{
      currentTelemetry,
      telemetryHistory,
      isSocketConnected,
      droneState,
      activeDroneId,
      setActiveDroneId,
      useSimulation,
      setUseSimulation,
      waypoints,
      addWaypoint,
      removeWaypoint,
      updateWaypointAltitude,
      clearWaypoints,
      uploadMissionToDrone,
      commandDrone,
      flightLogs,
      setFlightLogs,
      deleteFlightLog,
      settings,
      updateSettings,
      eventLogs,
      addEventLog
    }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  return useContext(TelemetryContext);
}
