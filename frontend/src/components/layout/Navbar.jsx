import {
    Wifi,
    WifiOff,
    Battery,
    Compass,
    LogOut,
    Zap,
    Activity,
} from "lucide-react";
import { useTelemetry } from "../../context/TelemetryContext";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
    const {
        currentTelemetry,
        isSocketConnected,
        droneState,
        commandDrone,
        useSimulation,
        setUseSimulation,
    } = useTelemetry();
    const { logout } = useAuth();

    // Get battery color
    const getBatteryColor = (level) => {
        if (level < 20) return "text-red-500 fill-red-500/10";
        if (level < 50) return "text-amber-500 fill-amber-500/10";
        return "text-emerald-500 fill-emerald-500/10";
    };

    return (
        <header className="h-16 glass-panel border-b border-amber-500/15 flex items-center justify-between px-6 z-10">
            {/* Title / Info */}
            <div className="flex items-center gap-3">
                <h2 className="font-bold text-stone-800 text-lg tracking-wide display-font uppercase">
                    Ground Control
                </h2>
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-xs font-semibold display-font border border-amber-500/10">
                    <Activity size={12} className="animate-pulse" />
                    <span>SYS_OK</span>
                </div>
            </div>

            {/* Quick Status / Indicators */}
            <div className="flex items-center gap-6">
                {/* Simulation Toggle */}
                <button
                    onClick={() => setUseSimulation((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider display-font border transition-all duration-200 cursor-pointer ${useSimulation
                            ? "bg-amber-500/15 text-amber-700 border-amber-500/25 shadow-xs"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        }`}
                >
                    <Zap size={13} className={useSimulation ? "animate-bounce" : ""} />
                    {useSimulation ? "Simulator Mode" : "Live Server"}
                </button>

                {/* Connection Status */}
                <div className="hidden md:flex items-center gap-4 border-l border-amber-500/10 pl-4 text-xs font-medium text-stone-600">
                    <div className="flex items-center gap-1.5">
                        {isSocketConnected ? (
                            <>
                                <Wifi size={14} className="text-emerald-500 animate-pulse" />
                                <span className="text-emerald-600 font-semibold display-font uppercase">
                                    Server Connected
                                </span>
                            </>
                        ) : (
                            <>
                                <WifiOff size={14} className="text-stone-400" />
                                <span className="text-stone-400 font-semibold display-font uppercase">
                                    Server Offline
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Compass
                            size={14}
                            className={
                                droneState === "FLYING"
                                    ? "text-amber-500 animate-spin"
                                    : "text-stone-400"
                            }
                            style={{ animationDuration: "4s" }}
                        />
                        <span
                            className={`font-semibold display-font uppercase ${currentTelemetry?.altitude > 0.5 ? "text-amber-600" : "text-stone-400"}`}
                        >
                            {currentTelemetry?.altitude > 0.5
                                ? "GPS LOCK (3D)"
                                : "GPS ACQUIRING"}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Battery
                            size={16}
                            className={getBatteryColor(currentTelemetry?.battery)}
                        />
                        <span className="mono-font text-stone-700 font-bold">
                            {currentTelemetry?.battery}%
                        </span>
                    </div>
                </div>

                {/* Simulated Drone Commands */}
                <div className="flex items-center gap-2 border-l border-amber-500/10 pl-4">
                    {droneState === "DISARMED" ? (
                        <button
                            onClick={() => commandDrone("ARM")}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold display-font uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-xs"
                        >
                            Arm Motor
                        </button>
                    ) : droneState === "ARMED" ? (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => commandDrone("DISARM")}
                                className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded text-xs font-semibold display-font uppercase tracking-wider transition-all duration-200 cursor-pointer"
                            >
                                Disarm
                            </button>
                            <button
                                onClick={() => commandDrone("TAKEOFF")}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-semibold display-font uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-xs"
                            >
                                Takeoff
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => commandDrone("LAND")}
                            className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded text-xs font-semibold display-font uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-xs"
                        >
                            Land Drone
                        </button>
                    )}
                </div>

                {/* Log out */}
                <button
                    onClick={logout}
                    className="p-1.5 text-stone-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-all duration-200 cursor-pointer"
                    title="Log Out"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
}
