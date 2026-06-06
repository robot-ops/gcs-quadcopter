import apiClient from "./apiClient";

export const loginApi = async (payload) => {
    const response = await apiClient.post("/auth/login", payload);
    return response.data;
};

export const fetchMe = async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
};

export const refreshTokenApi = async (refreshToken) => {
    const response = await apiClient.post("/auth/refresh", { refresh_token: refreshToken });
    return response.data;
};

export const logoutApi = async (refreshToken) => {
    const response = await apiClient.post("/auth/logout", { refresh_token: refreshToken });
    return response.data;
};
