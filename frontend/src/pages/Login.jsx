import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { KeyRound, User, Cpu, AlertTriangle } from "lucide-react";

export default function Login() {
    const { login, accessToken, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && accessToken) {
            navigate("/dashboard", { replace: true });
        }
    }, [accessToken, authLoading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const success = await login(username, password);
            if (success) {
                navigate("/dashboard");
            } else {
                setError("Login failed");
            }
        } catch (err) {
            const detailMsg = err.response?.data?.detail || err.message || "Invalid credentials";
            setError(detailMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-bg-base grid-overlay relative overflow-hidden">
            {/* Spinning decorative tech circles */}
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-orange-500/5 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div className="glass-panel p-8 rounded-2xl shadow-xl w-96 max-w-sm border border-amber-500/20 relative z-10 bracket-box">
                {/* Header Logo */}
                <div className="flex flex-col items-center mb-6">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 mb-2 glow-warm">
                        <Cpu className="animate-spin" style={{ animationDuration: '8s' }} size={32} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-stone-800 leading-none">AERO-LINK</h1>
                    <span className="text-xs text-amber-600 font-bold uppercase tracking-wider mt-1 display-font">
                        Digital Twin Quadcopter
                    </span>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-widest display-font mb-1">
                            Operator Username
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                                <User size={16} />
                            </span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g., admin"
                                className="w-full glass-input pl-10 pr-3 py-2 text-sm text-stone-800 placeholder-stone-400"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-widest display-font mb-1">
                            Access Security Key
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                                <KeyRound size={16} />
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full glass-input pl-10 pr-3 py-2 text-sm text-stone-800 placeholder-stone-400"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full glass-btn py-2.5 text-sm uppercase tracking-widest display-font cursor-pointer flex items-center justify-center gap-2"
                    >
                        {loading ? "Decrypting..." : "Connect Session"}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-stone-400 border-t border-amber-500/5 pt-4">
                    <p className="font-semibold text-[10px] uppercase tracking-wider text-amber-600/70">
                        Demo Mode Credentials
                    </p>
                    <p className="mt-1 font-mono">admin / admin123</p>
                </div>
            </div>
        </div>
    );
}
