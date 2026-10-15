export const createTelemetrySocket = (
    onMessage
) => {

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const defaultWsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;

    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {

        const data = JSON.parse(
            event.data
        );

        onMessage(data);
    };

    return socket;
};