import { createContext, useContext, useState, useEffect } from "react";
import { loginApi, fetchMe, logoutApi } from "../api/authApi";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(localStorage.getItem("access_token"));
    const [loading, setLoading] = useState(true);

    const loadCurrentUser = async () => {
        try {
            const userData = await fetchMe();
            setUser(userData);
            return userData;
        } catch (error) {
            console.error("Failed to load user profile:", error);
            localLogout();
            return null;
        }
    };

    useEffect(() => {
        const verifySession = async () => {
            const token = localStorage.getItem("access_token");
            if (token) {
                await loadCurrentUser();
            }
            setLoading(false);
        };

        verifySession();

        const handleForceLogout = () => {
            localLogout();
        };

        window.addEventListener("auth-logout", handleForceLogout);
        return () => {
            window.removeEventListener("auth-logout", handleForceLogout);
        };
    }, []);

    const login = async (username, password) => {
        setLoading(true);
        try {
            const credentials = await loginApi({ username, password });
            
            localStorage.setItem("access_token", credentials.access_token);
            localStorage.setItem("refresh_token", credentials.refresh_token);
            setAccessToken(credentials.access_token);

            const userData = await fetchMe();
            setUser(userData);
            return true;
        } catch (error) {
            localLogout();
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const localLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setAccessToken(null);
        setUser(null);
    };

    const logout = async () => {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
            try {
                await logoutApi(refreshToken);
            } catch (error) {
                console.error("Logout API call failed:", error);
            }
        }
        localLogout();
    };

    return (
        <AuthContext.Provider value={{ user, setUser, accessToken, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);