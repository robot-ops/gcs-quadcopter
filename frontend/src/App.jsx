import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { TelemetryProvider } from "./context/TelemetryContext";

function App() {
  return (
    <AuthProvider>
      <TelemetryProvider>
        <AppRoutes />
      </TelemetryProvider>
    </AuthProvider>
  );
}

export default App;