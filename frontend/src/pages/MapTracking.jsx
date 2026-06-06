import { useState, useEffect } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Crosshair, 
  Home, 
  Map, 
  Layers, 
  Compass, 
  Battery, 
  Gauge, 
  CloudLightning, 
  Radio, 
  Navigation,
  Loader2
} from "lucide-react";

// Home station coordinate constant
const HOME_COORDINATE = [-6.2088, 106.8456];

// Map theme URLs
const MAP_TILE_THEMES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// Custom Division Icon generators
const createHomeIcon = () => new L.divIcon({
  html: `<div class="w-8 h-8 flex items-center justify-center bg-stone-800 text-amber-500 rounded-lg shadow-lg border border-amber-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
         </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const createDroneIcon = (heading, droneState) => new L.divIcon({
  html: `<div class="relative w-8 h-8 flex items-center justify-center">
          ${droneState === "FLYING" || droneState === "TAKEOFF" ? 
            `<div class="absolute -inset-3 rounded-full bg-amber-500/25 animate-ping" style="animation-duration: 2s;"></div>` : ""}
          <div style="transform: rotate(${heading}deg); transition: transform 0.1s linear;" class="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-full shadow-lg border border-white relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
         </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Map control helper component
function MapController({ targetDrone, targetHome, dronePosition, homePosition }) {
  const map = useMap();

  useEffect(() => {
    if (targetDrone) {
      map.panTo(dronePosition, { animate: true, duration: 0.8 });
    }
  }, [targetDrone, dronePosition, map]);

  useEffect(() => {
    if (targetHome) {
      map.panTo(homePosition, { animate: true, duration: 0.8 });
    }
  }, [targetHome, homePosition, map]);

  return null;
}

export default function MapTracking() {
  const { currentTelemetry, telemetryHistory, droneState, isSocketConnected, useSimulation } = useTelemetry();
  const [mapTheme, setMapTheme] = useState("light");
  const [targetDrone, setTargetDrone] = useState(true);
  const [targetHome, setTargetHome] = useState(false);

  const dronePosition = [
    currentTelemetry?.latitude || -6.2088,
    currentTelemetry?.longitude || 106.8456
  ];

  // Dynamic trail polyline from telemetry history records
  const flightTrail = telemetryHistory
    .filter(t => t.altitude > 0.5)
    .map(t => [t.latitude, t.longitude]);

  // Handle re-center toggles manually
  const triggerRecenterDrone = () => {
    setTargetHome(false);
    setTargetDrone(true);
  };

  const triggerRecenterHome = () => {
    setTargetDrone(false);
    setTargetHome(true);
  };

  // Reset recenter flags when map is scrolled by user
  useEffect(() => {
    if (targetDrone || targetHome) {
      const timer = setTimeout(() => {
        setTargetDrone(false);
        setTargetHome(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [targetDrone, targetHome]);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-amber-500/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-stone-800 display-font uppercase">
            Active Map Tracking
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            Real-time geospatial positioning, heading navigation orientation, and Link telemetry quality indicators.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest display-font">Connection Channel</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block mt-0.5 border ${
              useSimulation 
                ? "bg-sky-500/10 text-sky-700 border-sky-500/15" 
                : isSocketConnected 
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/15" 
                  : "bg-rose-500/10 text-rose-700 border-rose-500/15"
            }`}>
              {useSimulation ? "Simulator Active" : isSocketConnected ? "Live Telemetry Connected" : "Awaiting Handshake..."}
            </span>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none"></div>
      </div>

      {/* Map Widget container */}
      <div className="glass-panel p-2 rounded-2xl border border-amber-500/15 overflow-hidden h-[550px] relative">
        <MapContainer 
          center={dronePosition} 
          zoom={17} 
          className="w-full h-full rounded-xl z-0"
          zoomControl={true}
        >
          <TileLayer
            key={mapTheme}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={MAP_TILE_THEMES[mapTheme]}
          />

          {/* Map re-centering agent controller */}
          <MapController 
            targetDrone={targetDrone} 
            targetHome={targetHome} 
            dronePosition={dronePosition} 
            homePosition={HOME_COORDINATE}
          />

          {/* GCS Base Station location Marker */}
          <Marker position={HOME_COORDINATE} icon={createHomeIcon()} />

          {/* Moving Drone telemetry Marker */}
          <Marker 
            position={dronePosition} 
            icon={createDroneIcon(currentTelemetry?.yaw || 0, droneState)} 
          />

          {/* Flight history trail path */}
          {flightTrail.length > 1 && (
            <Polyline 
              positions={flightTrail} 
              color="#ef4444" 
              weight={3} 
              opacity={0.8}
            />
          )}
        </MapContainer>

        {/* Map Control Buttons floating panel */}
        <div className="absolute bottom-6 left-6 z-[1000] flex gap-2">
          <button
            onClick={triggerRecenterDrone}
            className="p-3 bg-white/95 hover:bg-white text-stone-700 hover:text-amber-600 rounded-xl shadow-md border border-amber-500/10 flex items-center justify-center transition-all cursor-pointer"
            title="Locate Active Drone"
          >
            <Crosshair size={18} className={targetDrone ? "animate-pulse text-amber-500" : ""} />
          </button>
          <button
            onClick={triggerRecenterHome}
            className="p-3 bg-white/95 hover:bg-white text-stone-700 hover:text-amber-600 rounded-xl shadow-md border border-amber-500/10 flex items-center justify-center transition-all cursor-pointer"
            title="Locate GCS Home Station"
          >
            <Home size={18} className={targetHome ? "animate-pulse text-amber-500" : ""} />
          </button>
        </div>

        {/* Map Tile theme selectors */}
        <div className="absolute top-6 left-16 z-[1000] flex items-center gap-1 bg-white/95 px-2 py-1.5 rounded-xl border border-amber-500/10 shadow">
          <Layers size={14} className="text-stone-500 ml-1 mr-1" />
          <button
            onClick={() => setMapTheme("light")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold display-font uppercase transition-all cursor-pointer ${
              mapTheme === "light" ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Light
          </button>
          <button
            onClick={() => setMapTheme("dark")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold display-font uppercase transition-all cursor-pointer ${
              mapTheme === "dark" ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setMapTheme("streets")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold display-font uppercase transition-all cursor-pointer ${
              mapTheme === "streets" ? "bg-amber-500 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Streets
          </button>
        </div>

        {/* Dynamic Telemetry HUD overlay panel */}
        <div className="absolute top-6 right-6 z-[1000] w-64 bg-stone-900/90 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-2xl text-white space-y-3 pointer-events-auto">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-xs uppercase font-extrabold display-font tracking-wider flex items-center gap-1.5 text-amber-400">
              <Compass size={14} className="animate-spin" style={{ animationDuration: "12s" }} />
              HUD Telemetry
            </span>
            <span className={`w-2 h-2 rounded-full pulse-dot ${droneState === "DISARMED" ? "bg-amber-400" : "bg-emerald-500"}`}></span>
          </div>

          <div className="space-y-2 text-xs">
            {/* GPS coordinates */}
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-stone-400 font-medium">Latitude:</span>
              <span className="font-mono font-bold text-white">{(currentTelemetry?.latitude || 0).toFixed(6)}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-stone-400 font-medium">Longitude:</span>
              <span className="font-mono font-bold text-white">{(currentTelemetry?.longitude || 0).toFixed(6)}</span>
            </div>

            {/* Speed & Altitude */}
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-stone-400 font-medium flex items-center gap-1"><Gauge size={13} /> Speed:</span>
              <span className="font-mono font-bold text-emerald-400">{(currentTelemetry?.speed || 0).toFixed(1)} m/s</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-stone-400 font-medium flex items-center gap-1"><Navigation size={13} /> Altitude:</span>
              <span className="font-mono font-bold text-sky-400">{(currentTelemetry?.altitude || 0).toFixed(1)} m</span>
            </div>

            {/* Pitch & Roll & Yaw */}
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-stone-400 font-medium">Attitude (R/P):</span>
              <span className="font-mono text-white">
                {(currentTelemetry?.roll || 0).toFixed(0)}° / {(currentTelemetry?.pitch || 0).toFixed(0)}°
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
              <span className="text-stone-400 font-medium">Yaw (Yaw / Yaw):</span>
              <span className="font-mono font-bold text-amber-400">
                {Math.round(currentTelemetry?.yaw || 0)}°
              </span>
            </div>

            {/* Battery state */}
            <div className="border-b border-white/5 pb-2 pt-0.5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-stone-400 font-medium flex items-center gap-1"><Battery size={13} /> Battery:</span>
                <span className={`font-mono font-bold ${
                  (currentTelemetry?.battery || 0) < 20 ? "text-rose-400" : "text-emerald-400"
                }`}>{currentTelemetry?.battery || 0}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    (currentTelemetry?.battery || 0) < 20 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                  }`}
                  style={{ width: `${currentTelemetry?.battery || 0}%` }}
                ></div>
              </div>
            </div>

            {/* LoRa details */}
            <div className="flex justify-between items-center pb-1">
              <span className="text-stone-400 font-medium flex items-center gap-1"><Radio size={13} /> LoRa Signal:</span>
              <span className="font-mono text-stone-300">
                {currentTelemetry?.rssi || 0} dBm / {(currentTelemetry?.snr || 0).toFixed(1)} dB
              </span>
            </div>
          </div>
        </div>

        {/* Small Tooltip overlay at the bottom */}
        <div className="absolute bottom-4 left-32 bg-white/95 px-3 py-1.5 rounded-lg border border-amber-500/20 shadow text-[10px] text-stone-600 font-medium flex items-center gap-1.5 z-[1000] pointer-events-none">
          <CloudLightning size={12} className="text-amber-600 animate-pulse" />
          <span>Tracking flight telemetry stream over active WebSocket/Sim link.</span>
        </div>
      </div>
    </div>
  );
}
