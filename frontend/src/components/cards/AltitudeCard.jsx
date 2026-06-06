import { ArrowUpCircle } from "lucide-react";

export default function AltitudeCard({ altitude }) {
    const isWarning = altitude > 40; // Simulated warning height

    return (
        <div className={`glass-card p-5 rounded-xl border flex items-center justify-between relative overflow-hidden ${
            isWarning ? "border-rose-400/35 bg-rose-500/5" : "border-amber-500/10"
        }`}>
            <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-500 display-font">
                    Altitude
                </h3>
                <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold mono-font text-stone-800">
                        {altitude !== undefined ? altitude.toFixed(1) : "0.0"}
                    </span>
                    <span className="text-sm font-semibold text-stone-500 display-font">m</span>
                </div>
                <div className="text-[11px] text-stone-500 mt-2 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isWarning ? "bg-rose-500 pulse-dot" : "bg-emerald-500"}`}></span>
                    <span>{isWarning ? "Altitude Limit Alert" : "Safe Flight Ceiling"}</span>
                </div>
            </div>
            
            <div className={`p-3 rounded-lg ${isWarning ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}>
                <ArrowUpCircle size={24} className={altitude > 0.5 ? "animate-pulse" : ""} />
            </div>
            
            {/* Background glowing circle */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none"></div>
        </div>
    );
}