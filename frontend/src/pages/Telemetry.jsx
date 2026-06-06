import { useState } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts";
import { History, Download } from "lucide-react";

export default function Telemetry() {
    const { telemetryHistory } = useTelemetry();
    const [searchLimit, setSearchLimit] = useState(20);

    // Format time for XAxis labels
    const formatXAxisTime = (isoString) => {
        try {
            return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch {
            return "";
        }
    };

    // Filtered logs for the historical list
    const logList = [...telemetryHistory].reverse().slice(0, searchLimit);

    // Trigger dummy csv export of telemetry history
    const handleCsvExport = () => {
        let csvContent = "data:text/csv;charset=utf-8,Timestamp,Altitude(m),Speed(m/s),Battery(%),Roll(deg),Pitch(deg),Yaw(deg),RSSI(dBm),SNR(dB)\n";
        telemetryHistory.forEach(t => {
            csvContent += `${t.created_at},${t.altitude},${t.speed},${t.battery},${t.roll},${t.pitch},${t.yaw},${t.rssi},${t.snr}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `telemetry_history_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-panel p-6 rounded-2xl border border-amber-500/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-stone-800 display-font uppercase">
                        Telemetry Log Center
                    </h2>
                    <p className="text-sm text-stone-500 mt-1">
                        Analyze historical avionics sensor charts and download detailed telemetry CSV logs.
                    </p>
                </div>
                <button
                    onClick={handleCsvExport}
                    className="glass-btn flex items-center gap-2 px-4 py-2 cursor-pointer text-sm font-semibold display-font uppercase tracking-wider"
                >
                    <Download size={16} />
                    Export CSV
                </button>
            </div>

            {/* Graphs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Altitude & Speed Chart */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15">
                    <h3 className="text-sm uppercase tracking-widest font-bold text-stone-500 display-font mb-4 flex items-center gap-2">
                        <span>Avionics Curves</span>
                        <span className="text-[10px] text-amber-700 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/10">Altitude & Speed</span>
                    </h3>
                    
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={telemetryHistory}>
                                <defs>
                                    <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis 
                                    dataKey="created_at" 
                                    tickFormatter={formatXAxisTime}
                                    stroke="#78716c" 
                                    fontSize={10} 
                                    tickLine={false}
                                />
                                <YAxis stroke="#78716c" fontSize={10} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                        borderColor: '#f97316', 
                                        borderRadius: '8px',
                                        fontSize: '11px' 
                                    }} 
                                />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Area type="monotone" dataKey="altitude" name="Altitude (m)" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorAlt)" />
                                <Area type="monotone" dataKey="speed" name="Speed (m/s)" stroke="#d97706" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSpeed)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Battery & Attitude (Roll/Pitch) Chart */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15">
                    <h3 className="text-sm uppercase tracking-widest font-bold text-stone-500 display-font mb-4 flex items-center gap-2">
                        <span>Avionics Sensors</span>
                        <span className="text-[10px] text-amber-700 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/10">Battery & Attitude</span>
                    </h3>
                    
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={telemetryHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis 
                                    dataKey="created_at" 
                                    tickFormatter={formatXAxisTime}
                                    stroke="#78716c" 
                                    fontSize={10}
                                    tickLine={false}
                                />
                                <YAxis stroke="#78716c" fontSize={10} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                        borderColor: '#ea580c', 
                                        borderRadius: '8px',
                                        fontSize: '11px' 
                                    }} 
                                />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Line type="monotone" dataKey="battery" name="Battery (%)" stroke="#f97316" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="roll" name="Roll (°)" stroke="#ea580c" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="pitch" name="Pitch (°)" stroke="#eab308" strokeWidth={1.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* LoRa Signal Health Chart */}
                <div className="glass-panel p-5 rounded-2xl border border-amber-500/15">
                    <h3 className="text-sm uppercase tracking-widest font-bold text-stone-500 display-font mb-4 flex items-center gap-2">
                        <span>Signal Quality Center</span>
                        <span className="text-[10px] text-amber-700 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/10">RSSI & SNR</span>
                    </h3>
                    
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={telemetryHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis 
                                    dataKey="created_at" 
                                    tickFormatter={formatXAxisTime}
                                    stroke="#78716c" 
                                    fontSize={10}
                                    tickLine={false}
                                />
                                <YAxis stroke="#78716c" fontSize={10} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                        borderColor: '#d97706', 
                                        borderRadius: '8px',
                                        fontSize: '11px' 
                                    }} 
                                />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Line type="monotone" dataKey="rssi" name="RSSI (dBm)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="snr" name="SNR (dB)" stroke="#ea580c" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Historical Telemetry Logs Table */}
            <div className="glass-panel p-5 rounded-2xl border border-amber-500/15">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h3 className="text-sm uppercase tracking-widest font-bold text-stone-500 display-font flex items-center gap-2">
                        <History size={16} />
                        <span>Avionics Data Feed Logger</span>
                    </h3>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-xs text-stone-500 font-semibold display-font whitespace-nowrap">Show Limit:</span>
                        <select 
                            value={searchLimit}
                            onChange={(e) => setSearchLimit(Number(e.target.value))}
                            className="glass-input text-xs px-2.5 py-1"
                        >
                            <option value={10}>10 records</option>
                            <option value={20}>20 records</option>
                            <option value={50}>50 records</option>
                            <option value={100}>100 records</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-amber-500/10">
                    <table className="w-full text-left border-collapse bg-white/30 text-xs">
                        <thead>
                            <tr className="bg-amber-500/10 border-b border-amber-500/15 text-stone-700 display-font font-bold uppercase tracking-wider">
                                <th className="p-3.5">UTC Timestamp</th>
                                <th className="p-3.5">Altitude</th>
                                <th className="p-3.5">Speed</th>
                                <th className="p-3.5">Battery</th>
                                <th className="p-3.5">Attitude (R / P / Y)</th>
                                <th className="p-3.5">LoRa Link (RSSI / SNR)</th>
                                <th className="p-3.5">GPS Position</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-500/5 text-stone-600 font-medium">
                            {logList.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-6 text-center text-stone-400">
                                        No telemetry frames recorded yet. Connect to a drone.
                                    </td>
                                </tr>
                            ) : (
                                logList.map((log, idx) => (
                                    <tr key={idx} className="hover:bg-amber-500/5 transition-colors">
                                        <td className="p-3.5 font-mono text-stone-800">{new Date(log.created_at).toISOString()}</td>
                                        <td className="p-3.5 mono-font text-stone-800">{log.altitude.toFixed(1)} m</td>
                                        <td className="p-3.5 mono-font text-stone-800">{log.speed.toFixed(1)} m/s</td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                log.battery < 20 ? "bg-rose-500/15 text-rose-700" : "bg-emerald-500/15 text-emerald-700"
                                            }`}>
                                                {log.battery}%
                                            </span>
                                        </td>
                                        <td className="p-3.5 mono-font">
                                            {log.roll.toFixed(1)}° / {log.pitch.toFixed(1)}° / {log.yaw.toFixed(0)}°
                                        </td>
                                        <td className="p-3.5 mono-font">
                                            {log.rssi} dBm / {log.snr.toFixed(1)} dB
                                        </td>
                                        <td className="p-3.5 mono-font">
                                            {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
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