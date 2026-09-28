const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:4000/ws/updates");

ws.on("open", () => {
    console.log("Connected to Gateway WebSocket relay");
});

ws.on("message", (data) => {
    console.log("EVENT RECEIVED:", data.toString());
});

ws.on("close", () => {
    console.log("Disconnected");
});

ws.on("error", (err) => {
    console.log("WS error:", err.message);
});
