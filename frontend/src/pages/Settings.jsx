import { useState } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import { Sliders, Server, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function Settings() {
    const { useSimulation, setUseSimulation } = useTelemetry();
    const [wsUrl, setWsUrl] = useState("ws://127.0.0.1:8000/ws/telemetry");
    const [batteryThreshold, setBatteryThreshold] = useState(20);
    const [rssiThreshold, setRssiThreshold] = useState(-90);
    const [rollOffset, setRollOffset] = useState(0.0);
    const [pitchOffset, setPitchOffset] = useState(0.0);
    const [saved, setSaved] = useState(false);

    const handleSave = (e) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-panel p-6 rounded-2xl border border-amber-500/15">
                <h2 className="text-3xl font-extrabold tracking-tight text-stone-800 display-font uppercase">
                    Ground Station Configuration
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                    Set alert safety parameters, calibrate telemetry sensor offsets, and configure network API sockets.
                </p>
            </div>

            {/* Forms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* System Safety Limits */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15 space-y-4">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font border-b border-amber-500/10 pb-2 flex items-center gap-2">
                        <ShieldAlert size={16} className="text-amber-600" />
                        <span>Safety Alerts & Warnings</span>
                    </h3>

                    {/* Low battery warning slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold text-stone-600">
                            <span className="display-font uppercase">Low Battery Threshold</span>
                            <span className="mono-font text-amber-700">{batteryThreshold}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="10" 
                            max="40" 
                            value={batteryThreshold}
                            onChange={(e) => setBatteryThreshold(Number(e.target.value))}
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                        <p className="text-[10px] text-stone-400">Trigger critical land sequence and PFD alert notifications if battery drops below this limit.</p>
                    </div>

                    {/* Low RSSI Warning slider */}
                    <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center text-xs font-semibold text-stone-600">
                            <span className="display-font uppercase">Signal Weakness Alert (RSSI)</span>
                            <span className="mono-font text-amber-700">{rssiThreshold} dBm</span>
                        </div>
                        <input 
                            type="range" 
                            min="-110" 
                            max="-70" 
                            value={rssiThreshold}
                            onChange={(e) => setRssiThreshold(Number(e.target.value))}
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                        <p className="text-[10px] text-stone-400">Trigger Link Warning status if the LoRa received signal strength drops below this threshold.</p>
                    </div>
                </div>

                {/* IMU Sensor Offsets Calibration */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15 space-y-4">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font border-b border-amber-500/10 pb-2 flex items-center gap-2">
                        <Sliders size={16} className="text-amber-600" />
                        <span>IMU Gyro Calibration</span>
                    </h3>

                    {/* Roll Offset */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold text-stone-600">
                            <span className="display-font uppercase">Roll Angle Offset</span>
                            <span className="mono-font text-amber-700">{rollOffset.toFixed(1)}°</span>
                        </div>
                        <input 
                            type="range" 
                            min="-5" 
                            max="5" 
                            step="0.1"
                            value={rollOffset}
                            onChange={(e) => setRollOffset(Number(e.target.value))}
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                    </div>

                    {/* Pitch Offset */}
                    <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center text-xs font-semibold text-stone-600">
                            <span className="display-font uppercase">Pitch Angle Offset</span>
                            <span className="mono-font text-amber-700">{pitchOffset.toFixed(1)}°</span>
                        </div>
                        <input 
                            type="range" 
                            min="-5" 
                            max="5" 
                            step="0.1"
                            value={pitchOffset}
                            onChange={(e) => setPitchOffset(Number(e.target.value))}
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                    </div>
                    
                    <button 
                        onClick={() => { setRollOffset(0); setPitchOffset(0); }}
                        className="glass-btn-secondary px-3 py-1.5 text-[10px] uppercase font-bold display-font tracking-wider cursor-pointer"
                    >
                        Reset IMU Offsets
                    </button>
                </div>

                {/* Network & API Endpoints */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15 space-y-4 md:col-span-2">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font border-b border-amber-500/10 pb-2 flex items-center gap-2">
                        <Server size={16} className="text-amber-600" />
                        <span>Telemetry Sockets & Endpoints</span>
                    </h3>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-widest display-font mb-1">
                                    WebSocket Telemetry Stream Endpoint
                                </label>
                                <input 
                                    type="text" 
                                    value={wsUrl}
                                    onChange={(e) => setWsUrl(e.target.value)}
                                    className="w-full glass-input px-3 py-2 text-xs font-mono"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-widest display-font mb-1">
                                    Operator Telemetry Mode
                                </label>
                                <div className="flex items-center gap-2 mt-2">
                                    <input 
                                        type="checkbox" 
                                        id="simCheckbox"
                                        checked={useSimulation}
                                        onChange={(e) => setUseSimulation(e.target.checked)}
                                        className="accent-amber-500 w-4 h-4 cursor-pointer"
                                    />
                                    <label htmlFor="simCheckbox" className="text-xs text-stone-600 font-semibold display-font cursor-pointer uppercase select-none">
                                        Use Local Telemetry Simulator
                                    </label>
                                </div>
                            </div>
                        </div>

                        {saved && (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-700 text-xs flex items-center gap-2">
                                <CheckCircle2 size={14} className="shrink-0" />
                                <span>Settings updated and calibrated successfully.</span>
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="glass-btn px-5 py-2 text-xs font-semibold uppercase tracking-wider display-font cursor-pointer"
                        >
                            Apply Configurations
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}