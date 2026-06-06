import { Battery, BatteryCharging, BatteryWarning } from "lucide-react";
import { useTelemetry } from "../../context/TelemetryContext";

export default function BatteryCard({ battery }) {
    const { droneState } = useTelemetry();
    const isCharging = droneState === "DISARMED" && battery < 100;
    const isLow = battery < 20;

    const getIcon = () => {
        if (isCharging) return <BatteryCharging size={24} className="text-emerald-500 animate-bounce" />;
        if (isLow) return <BatteryWarning size={24} className="text-rose-500 animate-pulse" />;
        return <Battery size={24} className="text-amber-500" />;
    };

    const getMeterColor = () => {
        if (isLow) return "bg-rose-500";
        if (battery < 50) return "bg-amber-500";
        return "bg-emerald-500";
    };

    return (
        <div className={`glass-card p-5 rounded-xl border flex flex-col justify-between relative overflow-hidden h-full ${
            isLow ? "border-rose-400/35 bg-rose-500/5" : "border-amber-500/10"
        }`}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-500 display-font">
                        Battery Status
                    </h3>
                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-bold mono-font text-stone-800">
                            {battery}%
                        </span>
                    </div>
                </div>
                <div className={`p-3 rounded-lg ${
                    isCharging ? "bg-emerald-500/10" : isLow ? "bg-rose-500/10" : "bg-amber-500/10"
                }`}>
                    {getIcon()}
                </div>
            </div>

            {/* Battery bar */}
            <div className="mt-4">
                <div className="w-full bg-stone-200/50 rounded-full h-2 overflow-hidden border border-stone-200/20">
                    <div 
                        className={`h-full transition-all duration-500 ${getMeterColor()}`} 
                        style={{ width: `${battery}%` }}
                    ></div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-stone-500 mt-2 font-medium">
                    <span>{isCharging ? "AC Input Charging" : isLow ? "Critical! Land Now" : "Operational"}</span>
                    <span>11.4V</span>
                </div>
            </div>
            
            {/* Background glowing circle */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none"></div>
        </div>
    );
}