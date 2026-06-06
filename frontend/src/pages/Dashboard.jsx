import { useState, useEffect } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import AltitudeCard from "../components/cards/AltitudeCard";
import BatteryCard from "../components/cards/BatteryCard";
import GPSCard from "../components/cards/GPSCard";
import LoRaSignalCard from "../components/cards/LoRaSignalCard";
import SpeedCard from "../components/cards/SpeedCard";
import DroneTwin from "../components/DroneTwin";
import { Terminal, Cpu } from "lucide-react";

export default function Dashboard() {
    const { currentTelemetry, droneState } = useTelemetry();
    const [activeView, setActiveView] = useState("3d");
    const [eventLogs, setEventLogs] = useState([
        { time: new Date(Date.now() - 10000).toLocaleTimeString(), text: "GCS Initialized. Waiting for connection...", type: "system" }
    ]);

    // Reactively add logs based on telemetry change
    useEffect(() => {
        if (!currentTelemetry) return;
        const timeStr = new Date().toLocaleTimeString();

        // Battery warnings
        if (currentTelemetry.battery < 20) {
            setEventLogs(prev => {
                if (prev[0]?.text.includes("Battery Critical")) return prev;
                return [{ time: timeStr, text: `Battery Critical: ${currentTelemetry.battery}%`, type: "warn" }, ...prev.slice(0, 15)];
            });
        }

        // Drone armed/disarmed state changes
        setEventLogs(prev => {
            const lastLog = prev.find(l => l.text.includes("Drone state:"));
            if (lastLog && lastLog.text.includes(droneState)) return prev;
            return [{ time: timeStr, text: `Drone state: Motor state changed to ${droneState}`, type: "info" }, ...prev.slice(0, 15)];
        });

    }, [currentTelemetry?.battery, droneState]);

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="glass-panel p-6 rounded-2xl border border-amber-500/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-extrabold tracking-tight text-stone-800 display-font uppercase">
                        Digital Twin Monitor
                    </h2>
                    <p className="text-sm text-stone-500 mt-1">
                        Real-time avionics telemetry feed, sensor calibration, and 3D flight instrumentation.
                    </p>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest display-font">Active UAV</span>
                        <span className="text-sm font-semibold text-stone-800">Quadcopter X-1</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                        <Cpu className="animate-pulse" />
                    </div>
                </div>
                {/* Background ambient glow */}
                <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none"></div>
            </div>

            {/* Telemetry Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <AltitudeCard altitude={currentTelemetry?.altitude} />
                <BatteryCard battery={currentTelemetry?.battery} />
                <GPSCard latitude={currentTelemetry?.latitude} longitude={currentTelemetry?.longitude} />
                <LoRaSignalCard rssi={currentTelemetry?.rssi} snr={currentTelemetry?.snr} />
                <SpeedCard speed={currentTelemetry?.speed} />
            </div>

            {/* Instrument Panels (PFD & Compass) + System Log Terminal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Primary Flight Display (PFD) */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15 flex flex-col items-center min-h-[352px]">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font mb-4 w-full flex items-center justify-between">
                        <span>Attitude Indicator</span>
                        <div className="flex bg-amber-500/10 p-0.5 rounded-lg border border-amber-500/10 shrink-0">
                            <button
                                onClick={() => setActiveView("2d")}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold display-font uppercase transition-all cursor-pointer ${
                                    activeView === "2d" ? "bg-amber-500 text-white shadow-xs" : "text-stone-600 hover:text-stone-850"
                                }`}
                            >
                                2D PFD
                            </button>
                            <button
                                onClick={() => setActiveView("3d")}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold display-font uppercase transition-all cursor-pointer ${
                                    activeView === "3d" ? "bg-amber-500 text-white shadow-xs" : "text-stone-600 hover:text-stone-850"
                                }`}
                            >
                                3D Twin
                            </button>
                        </div>
                    </h3>
                    
                    {activeView === "2d" ? (
                        <>
                            {/* The artificial horizon sphere container */}
                            <div className="relative w-48 h-48 rounded-full border-4 border-amber-500/20 bg-stone-100 overflow-hidden shadow-inner flex items-center justify-center">
                                
                                {/* Sky & Ground boundary, translated by pitch and rotated by roll */}
                                <div 
                                    className="absolute w-72 h-72 flex flex-col transition-transform duration-100 ease-out"
                                    style={{
                                        transform: `translateY(${currentTelemetry?.pitch * 1.5}px) rotate(${currentTelemetry?.roll}deg)`
                                    }}
                                >
                                    {/* Sky */}
                                    <div className="w-full h-1/2 bg-sky-400 flex flex-col justify-end items-center pb-2 border-b border-white/40">
                                        {/* Pitch tick marks */}
                                        <div className="space-y-4 text-[9px] font-bold text-white/70 font-mono">
                                            <div className="w-10 border-t border-white/60 text-center relative pt-1">
                                                <span className="absolute -left-4 top-0">-20</span>
                                                <span className="absolute -right-4 top-0">-20</span>
                                            </div>
                                            <div className="w-6 border-t border-white/60 text-center"></div>
                                            <div className="w-10 border-t border-white/60 text-center relative pt-1">
                                                <span className="absolute -left-4 top-0">-10</span>
                                                <span className="absolute -right-4 top-0">-10</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Ground */}
                                    <div className="w-full h-1/2 bg-amber-700/90 flex flex-col justify-start items-center pt-2">
                                        <div className="space-y-4 text-[9px] font-bold text-white/70 font-mono">
                                            <div className="w-10 border-t border-white/60 text-center relative pt-1">
                                                <span className="absolute -left-4 top-0">10</span>
                                                <span className="absolute -right-4 top-0">10</span>
                                            </div>
                                            <div className="w-6 border-t border-white/60 text-center"></div>
                                            <div className="w-10 border-t border-white/60 text-center relative pt-1">
                                                <span className="absolute -left-4 top-0">20</span>
                                                <span className="absolute -right-4 top-0">20</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Static center crosshair representation of the drone */}
                                <div className="absolute w-24 h-2 flex items-center justify-between z-10 pointer-events-none">
                                    <div className="w-8 h-1 bg-amber-500 border border-stone-800 rounded-full"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-stone-800"></div>
                                    <div className="w-8 h-1 bg-amber-500 border border-stone-800 rounded-full"></div>
                                </div>
                            </div>

                            {/* Numerical display indicators */}
                            <div className="grid grid-cols-2 gap-4 mt-5 w-full text-center">
                                <div className="bg-white/40 border border-amber-500/10 p-2 rounded-lg">
                                    <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider display-font block">Pitch</span>
                                    <span className="mono-font text-base font-bold text-stone-800">{currentTelemetry?.pitch}°</span>
                                </div>
                                <div className="bg-white/40 border border-amber-500/10 p-2 rounded-lg">
                                    <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider display-font block">Roll</span>
                                    <span className="mono-font text-base font-bold text-stone-800">{currentTelemetry?.roll}°</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-[264px] rounded-xl overflow-hidden border border-amber-500/10">
                            <DroneTwin />
                        </div>
                    )}
                </div>

                {/* Compass Heading Indicator */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15 flex flex-col items-center">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font mb-4 w-full flex items-center justify-between">
                        <span>Heading / Compass</span>
                        <span className="text-[10px] text-amber-600 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10">Yaw</span>
                    </h3>

                    {/* Rotating Compass ring */}
                    <div className="relative w-48 h-48 rounded-full border-4 border-amber-500/20 bg-stone-50 overflow-hidden shadow-inner flex items-center justify-center">
                        {/* Heading dial rotated by -yaw */}
                        <div 
                            className="absolute w-44 h-44 rounded-full border border-dashed border-stone-300 flex items-center justify-center transition-transform duration-100 ease-out"
                            style={{
                                transform: `rotate(${-currentTelemetry?.yaw}deg)`
                            }}
                        >
                            <span className="absolute top-2 font-black text-sm text-amber-600">N</span>
                            <span className="absolute right-2 font-black text-sm text-stone-800">E</span>
                            <span className="absolute bottom-2 font-black text-sm text-stone-800">S</span>
                            <span className="absolute left-2 font-black text-sm text-stone-800">W</span>

                            {/* Degree increments */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                <div className="w-full border-t border-stone-300 rotate-45"></div>
                                <div className="w-full border-t border-stone-300 -rotate-45"></div>
                            </div>
                        </div>

                        {/* Heading Pointer Arrow (pointing straight up) */}
                        <div className="absolute top-1 flex flex-col items-center z-10">
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-rose-500"></div>
                            <div className="w-1.5 h-3 bg-rose-500"></div>
                        </div>

                        {/* Numerical value in the center */}
                        <div className="absolute w-14 h-14 bg-white/95 rounded-full border border-amber-500/10 shadow flex flex-col items-center justify-center">
                            <span className="text-[9px] uppercase font-bold text-stone-400 display-font">Heading</span>
                            <span className="mono-font text-xs font-extrabold text-stone-800">{Math.round(currentTelemetry?.yaw || 0)}°</span>
                        </div>
                    </div>

                    {/* Flight State card summary */}
                    <div className="mt-5 w-full bg-white/40 border border-amber-500/10 p-2 rounded-lg flex items-center justify-between px-4">
                        <span className="text-xs font-semibold text-stone-500 display-font uppercase">UAV Flight State</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full pulse-dot ${droneState === "DISARMED" ? "bg-amber-400" : "bg-emerald-500"}`}></span>
                            <span className="text-xs font-bold text-stone-700 uppercase display-font">{droneState}</span>
                        </div>
                    </div>
                </div>

                {/* System Terminal Log */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15 flex flex-col h-full">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font mb-4 w-full flex items-center justify-between">
                        <span>Event Terminal</span>
                        <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/10">
                            <Terminal size={12} />
                            <span>STDOUT</span>
                        </div>
                    </h3>

                    {/* Console body */}
                    <div className="flex-1 bg-stone-900 rounded-xl p-4 font-mono text-xs text-stone-300 space-y-2.5 overflow-y-auto max-h-[160px] lg:max-h-none border border-stone-800">
                        {eventLogs.map((log, idx) => (
                            <div key={idx} className="flex items-start gap-2 leading-relaxed">
                                <span className="text-amber-500 font-bold shrink-0">[{log.time}]</span>
                                <span className={
                                    log.type === "warn" 
                                        ? "text-rose-400 font-semibold" 
                                        : log.type === "system" 
                                            ? "text-sky-400" 
                                            : "text-emerald-400"
                                }>
                                    {log.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}