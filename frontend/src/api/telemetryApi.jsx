import apiClient from "./apiClient";

export const getLatestTelemetry = async (droneId) => {
    const response = await apiClient.get("/telemetry/latest", {
        params: {
            drone_id: droneId
        }
    });
    return response.data;
};

export const getTelemetryHistory = async (droneId, limit = 100) => {
    const response = await apiClient.get("/telemetry/history", {
        params: {
            drone_id: droneId,
            limit: limit
        }
    });
    return response.data;
};