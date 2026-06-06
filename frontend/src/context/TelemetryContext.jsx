import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getLatestTelemetry, getTelemetryHistory } from "../api/telemetryApi";

const TelemetryContext = createContext(null);

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
  const socketRef = useRef(null);
  const simulatedTimerRef = useRef(null);

  // Flight log collection for the flight log page
  const [flightLogs, setFlightLogs] = useState([
    { id: 1, date: "2026-06-03", duration: "12 mins", max_alt: "32 m", avg_speed: "4.5 m/s", status: "Completed" },
    { id: 2, date: "2026-06-02", duration: "8 mins", max_alt: "15 m", avg_speed: "3.2 m/s", status: "Completed" },
    { id: 3, date: "2026-05-30", duration: "25 mins", max_alt: "50 m", avg_speed: "5.8 m/s", status: "Aborted" }
  ]);

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
    const wsUrl = "ws://127.0.0.1:8000/ws/telemetry";

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
                created_at: msg.data.created_at || new Date().toISOString()
              };
              setCurrentTelemetry(tel);
              setTelemetryHistory(prev => {
                const next = [...prev, tel];
                return next.slice(-60);
              });
            } else if (msg.event === "command" && msg.data) {
              const cmd = msg.data.command;
              if (cmd === "ARM") {
                setDroneState("ARMED");
              } else if (cmd === "DISARM") {
                setDroneState("DISARMED");
              } else if (cmd === "TAKEOFF") {
                setDroneState("TAKEOFF");
              } else if (cmd === "LAND") {
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
  }, [useSimulation]);



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
    if (useSimulation) {
      if (cmd === "ARM") {
        setDroneState("ARMED");
      } else if (cmd === "DISARM") {
        setDroneState("DISARMED");
      } else if (cmd === "TAKEOFF") {
        if (droneState === "ARMED" || droneState === "DISARMED") {
          setDroneState("TAKEOFF");
        }
      } else if (cmd === "LAND") {
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
      commandDrone,
      flightLogs,
      setFlightLogs
    }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  return useContext(TelemetryContext);
}
