import { Radio } from "lucide-react";

export default function LoRaSignalCard({ rssi, snr }) {
    const rssiVal = rssi ?? -100;
    const snrVal = snr ?? 0.0;

    // Clamp RSSI -50 (best) → -120 (worst), map to 0-100%
    const lqPercent = Math.max(0, Math.min(100, Math.round(((rssiVal + 120) / 70) * 100)));

    const getQuality = (dbm) => {
        if (dbm > -60) return { label: "Excellent", color: "emerald" };
        if (dbm > -80) return { label: "Good",      color: "amber"   };
        if (dbm > -95) return { label: "Weak",      color: "orange"  };
        return              { label: "Critical",    color: "rose"    };
    };

    const quality = getQuality(rssiVal);
    const isWeak  = rssiVal <= -95;

    const barColor = {
        emerald: "bg-emerald-500",
        amber:   "bg-amber-400",
        orange:  "bg-orange-500",
        rose:    "bg-rose-500 animate-pulse",
    }[quality.color];

    const textColor = {
        emerald: "text-emerald-600",
        amber:   "text-amber-600",
        orange:  "text-orange-500",
        rose:    "text-rose-600",
    }[quality.color];

    const dotColor = {
        emerald: "bg-emerald-500",
        amber:   "bg-amber-400",
        orange:  "bg-orange-500",
        rose:    "bg-rose-500 pulse-dot",
    }[quality.color];

    return (
        <div className={`glass-card p-5 rounded-xl border flex flex-col justify-between relative overflow-hidden h-full ${
            isWeak ? "border-rose-400/35 bg-rose-500/5" : "border-amber-500/10"
        }`}>
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-500 display-font">
                    ELRS RF Link
                </h3>
                <div className={`p-2 rounded-lg ${isWeak ? "bg-rose-500/10 text-rose-600 animate-pulse" : "bg-amber-500/10 text-amber-600"}`}>
                    <Radio size={18} />
                </div>
            </div>

            {/* RSSI + SNR values */}
            <div className="flex gap-4 mt-1">
                <div>
                    <span className={`text-3xl font-bold mono-font ${textColor}`}>
                        {rssiVal}
                    </span>
                    <span className="text-xs font-semibold text-stone-500 display-font ml-1">dBm</span>
                    <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mt-0.5">RSSI</p>
                </div>
                <div className="border-l border-amber-500/10 pl-4">
                    <span className="text-xl font-bold mono-font text-stone-800">
                        {typeof snrVal === "number" ? snrVal.toFixed(1) : snrVal}
                    </span>
                    <span className="text-xs font-semibold text-stone-500 display-font ml-1">dB</span>
                    <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mt-0.5">SNR</p>
                </div>
            </div>

            {/* Link Quality bar */}
            <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">
                        Link Quality
                    </span>
                    <span className={`text-[10px] font-bold mono-font ${textColor}`}>
                        {lqPercent}%
                    </span>
                </div>
                <div className="w-full bg-stone-200/60 rounded-full h-1.5 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${lqPercent}%` }}
                    />
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className={`text-[10px] font-semibold ${textColor}`}>{quality.label}</span>
                </div>
            </div>

            {/* Background glowing circle */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none" />
        </div>
    );
}