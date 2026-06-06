import { MapPin } from "lucide-react";

export default function GPSCard({ latitude, longitude }) {
    return (
        <div className="glass-card p-5 rounded-xl border border-amber-500/10 flex items-center justify-between relative overflow-hidden h-full">
            <div className="flex-1 min-w-0">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-500 display-font">
                    GPS Coordinates
                </h3>
                <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-amber-600 display-font w-8">LAT:</span>
                        <span className="mono-font text-sm font-semibold text-stone-800 tracking-wider">
                            {latitude !== undefined ? latitude.toFixed(6) : "0.000000"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-amber-600 display-font w-8">LNG:</span>
                        <span className="mono-font text-sm font-semibold text-stone-800 tracking-wider">
                            {longitude !== undefined ? longitude.toFixed(6) : "0.000000"}
                        </span>
                    </div>
                </div>
                <div className="text-[10px] text-stone-500 mt-2 font-medium">
                    Satellites Locked: 14 (3D Fix)
                </div>
            </div>
            
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-lg shrink-0">
                <MapPin size={24} className="animate-bounce" style={{ animationDuration: '3s' }} />
            </div>

            {/* Background glowing circle */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-amber-500/5 blur-xl pointer-events-none"></div>
        </div>
    );
}