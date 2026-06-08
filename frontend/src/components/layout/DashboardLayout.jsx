import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function DashboardLayout() {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-bg-base grid-overlay">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content layout */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Glassy Top Navigation */}
                <Navbar />

                {/* Glassy Scrollable Main Content area */}
                <main className="flex-1 overflow-y-auto p-6 relative flex flex-col">
                    <div className="max-w-7xl mx-auto space-y-6 flex-1">
                        <Outlet />
                    </div>
                    
                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-amber-500/10 text-center text-sm text-stone-500">
                        <p className="font-medium">Developed by <span className="text-amber-600 font-semibold">Redesma Technologies</span></p>
                    </div>
                </main>
            </div>
        </div>
    );
}
