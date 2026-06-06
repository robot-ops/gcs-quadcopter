import { Radio, Signal } from "lucide-react";

export default function LoRaSignalCard({ rssi, snr }) {
    const isWeak = rssi < -90;

    const getSignalQuality = (dbm) => {
        if (dbm > -60) return "Excellent";
        if (dbm > -80) return "Good";
        if (dbm > -95) return "Weak";
        return "Critical";
    };

    return (
        <div className={`glass-card p-5 rounded-xl border flex items-center justify-between relative overflow-hidden h-full ${
            isWeak ? "border-rose-400/35 bg-rose-500/5" : "border-amber-500/10"
        }`}>
            <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-500 display-font">
                    LoRa Link Signal
                </h3>
                <div className="flex gap-4 mt-2">
                    <div>
                        <span className="text-3xl font-bold mono-font text-stone-800">
                            {rssi !== undefined ? rssi : -100}
                        </span>
                        <span className="text-xs font-semibold text-stone-500 display-font ml-1">dBm</span>
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mt-0.5">RSSI</p>
                    </div>
                    <div className="border-l border-amber-500/10 pl-4">
                        <span className="text-xl font-bold mono-font text-stone-800">
                            {snr !== undefined ? snr : 0.0}
                        </span>
                        <span className="text-xs font-semibold text-stone-500 display-font ml-1">dB</span>
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mt-0.5">SNR</p>
                    </div>
                </div>
                <div className="text-[10px] text-stone-500 mt-2 flex items-center gap-1 font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${isWeak ? "bg-rose-500 pulse-dot" : "bg-emerald-500"}`}></span>
                    <span>Link Quality: {getSignalQuality(rssi)}</span>
                </div>
            </div>
            
            <div className={`p-3 rounded-lg ${isWeak ? "bg-rose-500/10 text-rose-600 animate-pulse" : "bg-amber-500/10 text-amber-600"}`}>
                <Radio size={24} />
            </div>

            {/* Background glowing circle */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none"></div>
        </div>
    );
}