export const createTelemetrySocket = (
    onMessage
) => {

    const socket = new WebSocket(
        "ws://127.0.0.1:8000/ws/telemetry"
    );

    socket.onmessage = (event) => {

        const data = JSON.parse(
            event.data
        );

        onMessage(data);
    };

    return socket;
};