import {
    Navigate
} from "react-router-dom";

import {
    useAuth
} from "../context/AuthContext";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export default function ProtectedRoute({
    children
}) {

    const {
        accessToken
    } = useAuth();

    if (!accessToken && !DEMO_MODE) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    return children;
}
