import { useTelemetry } from "../context/TelemetryContext";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map, Navigation, Trash2, Play, Power, HelpCircle, X } from "lucide-react";

// Fix Leaflet icons with custom SVGs to bypass Vite bundle path issues and match warm theme
const createDroneIcon = (heading) => new L.divIcon({
  html: `<div style="transform: rotate(${heading}deg); transition: transform 0.1s linear;" class="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-full shadow-lg border border-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
         </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const createWaypointIcon = (seq) => new L.divIcon({
  html: `<div class="w-6 h-6 rounded-full bg-amber-600/90 text-white flex items-center justify-center font-bold text-xs shadow-md border border-white">
          ${seq}
         </div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Map click handler to add waypoints
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Auto-pan map to follow drone position
function MapFollower({ position, droneState }) {
  const map = useMap();

  if (droneState === "FLYING" || droneState === "TAKEOFF") {
    map.panTo(position, { animate: true, duration: 0.5 });
  }

  return null;
}

export default function Mission() {
    const { 
      currentTelemetry, 
      telemetryHistory,
      waypoints, 
      addWaypoint, 
      removeWaypoint,
      updateWaypointAltitude,
      clearWaypoints, 
      commandDrone, 
      droneState 
    } = useTelemetry();

    const dronePosition = [
      currentTelemetry?.latitude || -6.2088, 
      currentTelemetry?.longitude || 106.8456
    ];

    // Build drone trail from telemetry history
    const droneTrail = telemetryHistory
      .filter(t => t.altitude > 0.5)
      .map(t => [t.latitude, t.longitude]);

    // Build line path linking drone coordinate to all sequential waypoints
    const waypointPath = [
      dronePosition,
      ...waypoints.map(w => [w.lat, w.lng])
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-panel p-6 rounded-2xl border border-amber-500/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-stone-800 display-font uppercase">
                        Mission Planner
                    </h2>
                    <p className="text-sm text-stone-500 mt-1">
                        Plot visual waypoints on the telemetry map to direct the simulated flight path.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={clearWaypoints}
                        className="glass-btn-secondary flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs font-semibold display-font uppercase tracking-wider"
                    >
                        <Trash2 size={14} />
                        Clear Waypoints
                    </button>
                    {droneState === "DISARMED" ? (
                        <button
                            onClick={() => commandDrone("ARM")}
                            className="glass-btn flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs font-semibold display-font uppercase tracking-wider"
                        >
                            <Power size={14} />
                            Arm Engine
                        </button>
                    ) : droneState === "ARMED" ? (
                        <button
                            onClick={() => commandDrone("TAKEOFF")}
                            className="glass-btn flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs font-semibold display-font uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 border-emerald-500/25"
                        >
                            <Play size={14} />
                            Launch Mission
                        </button>
                    ) : (
                        <button
                            onClick={() => commandDrone("LAND")}
                            className="glass-btn flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs font-semibold display-font uppercase tracking-wider bg-rose-500 hover:bg-rose-600 border-rose-500/25"
                        >
                            <Navigation size={14} />
                            Abort / Return Land
                        </button>
                    )}
                </div>
            </div>

            {/* Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Leaflet Map Widget */}
                <div className="lg:col-span-2 glass-panel p-2 rounded-2xl border border-amber-500/15 overflow-hidden h-[450px] relative">
                    <MapContainer 
                        center={dronePosition} 
                        zoom={17} 
                        className="w-full h-full rounded-xl z-0"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        />
                        
                        {/* Interactive Click Handler */}
                        <MapClickHandler onMapClick={addWaypoint} />

                        {/* Auto-follow drone */}
                        <MapFollower position={dronePosition} droneState={droneState} />

                        {/* Drone Marker */}
                        <Marker 
                            position={dronePosition} 
                            icon={createDroneIcon(currentTelemetry?.yaw || 0)}
                        />

                        {/* Drone Trail (actual path taken) */}
                        {droneTrail.length > 1 && (
                            <Polyline 
                                positions={droneTrail} 
                                color="#ef4444" 
                                weight={2} 
                                opacity={0.6}
                            />
                        )}

                        {/* Waypoint Markers */}
                        {waypoints.map((wp, idx) => (
                            <Marker 
                                key={idx} 
                                position={[wp.lat, wp.lng]} 
                                icon={createWaypointIcon(wp.seq)}
                            />
                        ))}

                        {/* Flight Vector Path line */}
                        <Polyline 
                            positions={waypointPath} 
                            color="#d97706" 
                            dashArray="5, 10" 
                            weight={3} 
                        />
                    </MapContainer>

                    {/* Helper Tooltip Overlay */}
                    <div className="absolute bottom-4 left-4 bg-white/95 px-3 py-1.5 rounded-lg border border-amber-500/20 shadow text-[10px] text-stone-600 font-medium flex items-center gap-1.5 z-[1000] pointer-events-none">
                        <HelpCircle size={12} className="text-amber-600" />
                        <span>Left-click anywhere on the map to queue waypoint commands.</span>
                    </div>
                </div>

                {/* Waypoints List Sidebar */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15 flex flex-col h-[450px]">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font mb-4 flex items-center justify-between border-b border-amber-500/10 pb-2">
                        <span>Waypoint Coordinates Queue</span>
                        <span className="text-[10px] text-amber-700 font-bold px-2 py-0.5 rounded-full bg-amber-500/10">
                            {waypoints.length} Total
                        </span>
                    </h3>

                    {/* Waypoint table items */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {waypoints.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 text-xs p-6 space-y-2">
                                <Map size={24} className="stroke-1 text-amber-500/50" />
                                <p>Queue is empty. Click the map to plan coordinates.</p>
                            </div>
                        ) : (
                            waypoints.map((wp, idx) => (
                                <div 
                                    key={idx} 
                                    className="bg-white/45 p-3 rounded-lg border border-amber-500/10 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center text-xs font-bold font-mono">
                                            {wp.seq}
                                        </span>
                                        <div>
                                            <p className="text-[11px] text-stone-800 font-semibold mono-font">
                                                LAT: {wp.lat.toFixed(6)}
                                            </p>
                                            <p className="text-[11px] text-stone-800 font-semibold mono-font">
                                                LNG: {wp.lng.toFixed(6)}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-[10px] text-stone-500 font-medium uppercase">ALT:</span>
                                                <input
                                                    type="number"
                                                    value={wp.alt || 15.0}
                                                    onChange={(e) => updateWaypointAltitude(idx, parseFloat(e.target.value) || 0)}
                                                    className="w-14 bg-white/60 border border-amber-500/20 rounded px-1 py-0.5 text-[10px] font-semibold font-mono text-stone-700 focus:outline-none focus:border-amber-500"
                                                    min="1"
                                                    max="200"
                                                />
                                                <span className="text-[9px] text-stone-400 font-mono">m</span>
                                            </div>
                                        </div>
                                    </div>
                                    {removeWaypoint && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeWaypoint(idx); }}
                                            className="p-1 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            title="Remove waypoint"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-amber-500/10 text-[10px] text-stone-500 leading-normal">
                        <span className="font-bold text-amber-600 block uppercase tracking-wider mb-1">Navigation Instructions</span>
                        Arm the motors and initiate takeoff. The UAV will automatically track and cycle through the waypoint sequence list in loop.
                    </div>
                </div>

            </div>
        </div>
    );
}