import { io, Socket } from "socket.io-client";

const API_BASE_URL =
  (import.meta as any).env.VITE_API_URL || "http://localhost:5000";

// Create socket instance with proper configuration
const socket: Socket = io(API_BASE_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ["websocket", "polling"],
});

// Connection event handlers
socket.on("connect", () => {
  console.log("✅ Connected to server:", socket.id);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});

socket.on("connect_error", (error: any) => {
  console.error("Connection error:", error);
});

export { socket };
