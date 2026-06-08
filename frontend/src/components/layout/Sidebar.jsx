import {
    LayoutDashboard,
    Radio,
    Map,
    FileText,
    Settings,
    Cpu,
    User,
    Compass
} from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { useTelemetry } from "../../context/TelemetryContext";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar() {
    const { currentTelemetry, droneState } = useTelemetry();
    const { user, logout } = useAuth();

    const linkClass = ({ isActive }) => 
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 display-font text-lg tracking-wide ${
            isActive 
                ? "bg-amber-500/15 text-amber-800 font-semibold border-l-4 border-amber-500 shadow-xs" 
                : "text-stone-600 hover:text-amber-700 hover:bg-amber-500/5"
        }`;

    return (
        <aside className="w-64 glass-panel border-r border-amber-500/15 flex flex-col h-full z-10 p-4">
            {/* University Logos */}
            <div className="mb-6 px-2 py-4 border-b border-amber-500/10 flex gap-4 items-center justify-center">
                <img src="/itb.svg" alt="ITB Logo" className="h-14 w-14 object-contain" />
                <img src="/undip.svg" alt="UNDIP Logo" className="h-14 w-14 object-contain scale-150 origin-center" />
            </div>

            {/* Header / Logo */}
            <div className="mb-8 px-2 py-4 border-b border-amber-500/10">
                <Link to="/dashboard" className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
                        <Cpu className="animate-spin" style={{ animationDuration: '6s' }} size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-stone-800 leading-none">AERO-LINK</h1>
                        <span className="text-xs text-amber-600 font-semibold tracking-wider uppercase display-font">Digital Twin</span>
                    </div>
                </Link>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 flex flex-col gap-1">
                <NavLink to="/dashboard" className={linkClass}>
                    <LayoutDashboard size={20} />
                    Dashboard
                </NavLink>

                <NavLink to="/tracking" className={linkClass}>
                    <Compass size={20} />
                    Map Tracking
                </NavLink>

                <NavLink to="/telemetry" className={linkClass}>
                    <Radio size={20} />
                    Telemetry Logs
                </NavLink>

                <NavLink to="/mission" className={linkClass}>
                    <Map size={20} />
                    Mission Planner
                </NavLink>


                <NavLink to="/flight-logs" className={linkClass}>
                    <FileText size={20} />
                    Flight History
                </NavLink>

                <NavLink to="/settings" className={linkClass}>
                    <Settings size={20} />
                    System Settings
                </NavLink>
            </nav>

            {/* Operator/User widget */}
            <div className="mt-auto border-t border-amber-500/10 pt-4 flex flex-col gap-3">
                <div className="bg-white/40 p-3 rounded-lg border border-amber-500/5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-700">
                        <User size={18} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-stone-800 truncate">{user?.username || "operator"}</p>
                        <p className="text-xs text-stone-500 uppercase tracking-widest display-font">ROLE: {user?.role || "Operator"}</p>
                    </div>
                </div>
                
                {/* Live Status indicator */}
                <div className="px-2 flex items-center justify-between text-xs text-stone-500">
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full pulse-dot ${droneState === "DISARMED" ? "bg-amber-400" : "bg-emerald-500"}`}></span>
                        <span className="font-medium capitalize text-stone-600">{droneState.toLowerCase()}</span>
                    </div>
                    <span className="mono-font text-amber-600">BAT: {currentTelemetry?.battery}%</span>
                </div>
            </div>
        </aside>
    );
}
