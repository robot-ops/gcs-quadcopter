import { Gauge } from "lucide-react";

export default function SpeedCard({ speed }) {
    const isHigh = speed > 8; // High speed threshold

    return (
        <div className="glass-card p-5 rounded-xl border border-amber-500/10 flex items-center justify-between relative overflow-hidden h-full">
            <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-500 display-font">
                    Ground Speed
                </h3>
                <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold mono-font text-stone-800">
                        {speed !== undefined ? speed.toFixed(1) : "0.0"}
                    </span>
                    <span className="text-sm font-semibold text-stone-500 display-font">m/s</span>
                </div>
                <div className="text-[10px] text-stone-500 mt-2 flex items-center gap-1 font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                    <span>{isHigh ? "High-Speed Cruising" : "Standard Speed"}</span>
                </div>
            </div>
            
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-lg">
                <Gauge size={24} className={speed > 0.5 ? "animate-pulse" : ""} />
            </div>

            {/* Background glowing circle */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none"></div>
        </div>
    );
}