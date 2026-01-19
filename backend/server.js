import express from "express";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";

import { app, server } from "./socket/socket.js";
import connectDB from "./db/db.js";
import authRoutes from "./routes/auth.routes.js";
import packageRoutes from "./routes/package.routes.js";

dotenv.config();

const port = process.env.PORT || 5000;

const __dirname = path.resolve();

// Connect to MongoDB
connectDB();

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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/packages", packageRoutes);

// Serve static files in production
app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
