import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";
import { Cpu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

import Login from "../pages/Login";

import Dashboard from "../pages/Dashboard";
import Telemetry from "../pages/Telemetry";
import Mission from "../pages/Mission";
import MapTracking from "../pages/MapTracking";
import FlightLogs from "../pages/FlightLogs";
import Settings from "../pages/Settings";
import DashboardLayout from "../components/layout/DashboardLayout";
import ProtectedRoute from "../components/ProtectedRoute";

export default function AppRoutes() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-base relative overflow-hidden">
                <div className="flex flex-col items-center">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 mb-2 glow-warm">
                        <Cpu className="animate-spin" style={{ animationDuration: '2s' }} size={48} />
                    </div>
                    <h1 className="text-xl font-bold tracking-wider text-stone-850 animate-pulse uppercase display-font">
                        Securing Link Session...
                    </h1>
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>

            <Routes>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Login />} />

                <Route element={<DashboardLayout />}>

                    <Route path="/dashboard"
                        element={
                            <ProtectedRoute>

                                <Dashboard />

                            </ProtectedRoute>
                        }
                    />

                    <Route path="/telemetry"
                        element={
                            <ProtectedRoute>

                                <Telemetry />

                            </ProtectedRoute>
                        }
                    />

                    <Route path="/mission"
                        element={
                            <ProtectedRoute>
                                <Mission />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/tracking"
                        element={
                            <ProtectedRoute>
                                <MapTracking />
                            </ProtectedRoute>
                        }
                    />



                    <Route path="/flight-logs"
                        element={
                            <ProtectedRoute>
                                <FlightLogs />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/settings"
                        element={
                            <ProtectedRoute>
                                <Settings />
                            </ProtectedRoute>
                        }
                    />

                </Route>

            </Routes>

        </BrowserRouter>
    );
}