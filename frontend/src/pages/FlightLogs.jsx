import { useTelemetry } from "../context/TelemetryContext";
import { FileText, Calendar, Clock, Trophy, Trash2, Download } from "lucide-react";

export default function FlightLogs() {
    const { flightLogs, setFlightLogs } = useTelemetry();

    const handleDeleteLog = (id) => {
        setFlightLogs(prev => prev.filter(log => log.id !== id));
    };

    const handleDownloadLog = (log) => {
        let csvContent = `data:text/csv;charset=utf-8,Parameter,Value\n`;
        csvContent += `Log Date,${log.date}\n`;
        csvContent += `Duration,${log.duration}\n`;
        csvContent += `Max Altitude,${log.max_alt}\n`;
        csvContent += `Average Speed,${log.avg_speed}\n`;
        csvContent += `Flight Status,${log.status}\n`;
        csvContent += `UAV model,Quadcopter X-1\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `flight_log_${log.date}_${log.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-panel p-6 rounded-2xl border border-amber-500/15">
                <h2 className="text-3xl font-extrabold tracking-tight text-stone-800 display-font uppercase">
                    Completed Flight History
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                    Review post-flight analysis telemetry graphs, export flight paths, and clean telemetry registers.
                </p>
            </div>

            {/* List Table */}
            <div className="glass-panel p-5 rounded-2xl border border-amber-500/15">
                <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 display-font mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    <span>Historical Flight Log Register</span>
                </h3>

                <div className="overflow-x-auto rounded-xl border border-amber-500/10">
                    <table className="w-full text-left border-collapse bg-white/30 text-xs">
                        <thead>
                            <tr className="bg-amber-500/10 border-b border-amber-500/15 text-stone-700 display-font font-bold uppercase tracking-wider">
                                <th className="p-3.5"><span className="flex items-center gap-1"><Calendar size={13} /> Mission Date</span></th>
                                <th className="p-3.5"><span className="flex items-center gap-1"><Clock size={13} /> Flight Duration</span></th>
                                <th className="p-3.5"><span className="flex items-center gap-1"><Trophy size={13} /> Peak Altitude</span></th>
                                <th className="p-3.5">Average Speed</th>
                                <th className="p-3.5">Flight Outcome</th>
                                <th className="p-3.5 text-center">Telemetry Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-500/5 text-stone-600 font-medium">
                            {flightLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-stone-400">
                                        No flight records found in Ground Station flash registry.
                                    </td>
                                </tr>
                            ) : (
                                flightLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-amber-500/5 transition-colors">
                                        <td className="p-3.5 font-semibold text-stone-800">{log.date}</td>
                                        <td className="p-3.5 mono-font text-stone-800">{log.duration}</td>
                                        <td className="p-3.5 mono-font text-stone-800">{log.max_alt}</td>
                                        <td className="p-3.5 mono-font text-stone-800">{log.avg_speed}</td>
                                        <td className="p-3.5">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border display-font ${
                                                log.status === "Completed" 
                                                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/15" 
                                                    : "bg-amber-500/10 text-amber-700 border-amber-500/15"
                                            }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleDownloadLog(log)}
                                                    className="p-1.5 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/10 rounded-lg transition-colors cursor-pointer"
                                                    title="Download Telemetry Log"
                                                >
                                                    <Download size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLog(log.id)}
                                                    className="p-1.5 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border border-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                                    title="Purge Log"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}