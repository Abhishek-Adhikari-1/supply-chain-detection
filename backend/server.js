import express from "express";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";

import { app, server } from "./socket/socket.js";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();

const port = process.env.PORT || 5000;

const __dirname = path.resolve();

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);

// Serve static files in production
app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
