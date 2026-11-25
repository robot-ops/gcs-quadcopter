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

export const uploadMissionApi = async (droneId, waypoints, missionName = "Auto Waypoint Mission") => {
    const response = await apiClient.post("/missions", {
        drone_id: droneId,
        mission_name: missionName,
        waypoints: waypoints.map((wp, idx) => ({
            seq: wp.seq || idx + 1,
            latitude: wp.lat,
            longitude: wp.lng,
            altitude: wp.alt || 15.0
        }))
    });
    return response.data;
};

export const getLatestMissionApi = async (droneId = 1) => {
    const response = await apiClient.get("/missions/latest", {
        params: { drone_id: droneId }
    });
    return response.data;
};

export const getFlightLogsApi = async (droneId = 1, limit = 50) => {
    const response = await apiClient.get("/flight-logs", {
        params: { drone_id: droneId, limit }
    });
    return response.data;
};

export const deleteFlightLogApi = async (logId) => {
    const response = await apiClient.delete(`/flight-logs/${logId}`);
    return response.data;
};