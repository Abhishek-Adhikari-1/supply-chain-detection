import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Handle user-specific room joining
  socket.on("join:user", (userId) => {
    if (userId) {
      const roomName = `user:${userId}`;
      socket.join(roomName);
      console.log(`User ${userId} joined room: ${roomName}`);
    }
  });

  // Handle user leaving their room
  socket.on("leave:user", (userId) => {
    if (userId) {
      const roomName = `user:${userId}`;
      socket.leave(roomName);
      console.log(`User ${userId} left room: ${roomName}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

export { app, io, server };
