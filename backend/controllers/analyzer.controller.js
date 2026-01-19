import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { io } from "../socket/socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use venv Python if available, otherwise system python3
const PYTHON_CMD = fs.existsSync(
  path.join(__dirname, "../../.venv/bin/python3"),
)
  ? path.join(__dirname, "../../.venv/bin/python3")
  : "python3";

export const analyzeProject = async (req, res) => {
  try {
    const { projectPath, analysisId: clientAnalysisId } = req.body;

    const analysisId = clientAnalysisId || crypto.randomUUID();
    const userId = req.user?._id?.toString();

    if (!projectPath) {
      return res.status(400).json({ error: "Project path is required" });
    }

    const scriptPath = path.join(__dirname, "../../scanner_predictor.py");
    const resolvedProjectPath = path.resolve(projectPath);

    const pythonProcess = spawn(PYTHON_CMD, [scriptPath, resolvedProjectPath]);

    io.emit("analysis:start", {
      analysisId,
      userId,
      projectPath: resolvedProjectPath,
      source: "project",
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      io.emit("analysis:log", { analysisId, userId, chunk, stream: "stdout" });
    });

    pythonProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      io.emit("analysis:log", { analysisId, userId, chunk, stream: "stderr" });
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Python stderr:", stderr);
        io.emit("analysis:error", {
          analysisId,
          userId,
          error: stderr || "Analysis failed",
        });
        return res.status(500).json({
          error: "Analysis failed",
          details: stderr,
        });
      }

      try {
        const result = JSON.parse(stdout);
        io.emit("analysis:complete", { analysisId, userId, result });
        res.status(200).json({ analysisId, ...result });
      } catch (error) {
        console.error("Failed to parse Python output:", stdout);
        io.emit("analysis:error", {
          analysisId,
          userId,
          error: error.message,
        });
        res.status(500).json({
          error: "Failed to parse analysis results",
          details: error.message,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error("Failed to start Python process:", error);
      io.emit("analysis:error", { analysisId, userId, error: error.message });
      res.status(500).json({
        error: "Failed to start analysis",
        details: error.message,
      });
    });
  } catch (error) {
    console.error("Error in analyzeProject controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const analyzeUploadedFile = async (req, res) => {
  const tempDir = path.join(os.tmpdir(), "supply-chain-analysis");
  const tempProjectDir = path.join(tempDir, `project-${Date.now()}`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = req.file.originalname;
    if (fileName !== "package.json" && fileName !== "requirements.txt") {
      return res
        .status(400)
        .json({ error: "Only package.json or requirements.txt are allowed" });
    }

    // Create temp directory structure
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(tempProjectDir, { recursive: true });

    // Write the uploaded file to temp directory
    const filePath = path.join(tempProjectDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    // If package.json, create a dummy node_modules structure
    if (fileName === "package.json") {
      const nodeModulesDir = path.join(tempProjectDir, "node_modules");
      fs.mkdirSync(nodeModulesDir, { recursive: true });
    }

    const analysisId =
      req.body?.analysisId && req.body.analysisId !== ""
        ? req.body.analysisId
        : crypto.randomUUID();
    const userId = req.user?._id?.toString();

    const scriptPath = path.join(__dirname, "../../scanner_predictor.py");
    const pythonProcess = spawn(PYTHON_CMD, [scriptPath, tempProjectDir]);

    io.emit("analysis:start", {
      analysisId,
      userId,
      projectPath: tempProjectDir,
      source: "upload",
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      io.emit("analysis:log", { analysisId, userId, chunk, stream: "stdout" });
    });

    pythonProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      io.emit("analysis:log", { analysisId, userId, chunk, stream: "stderr" });
    });

    pythonProcess.on("close", (code) => {
      // Clean up temp directory
      try {
        fs.rmSync(tempProjectDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("Failed to clean up temp directory:", cleanupErr);
      }

      if (code !== 0) {
        console.error("Python stderr:", stderr);
        io.emit("analysis:error", {
          analysisId,
          userId,
          error: stderr || "Analysis failed",
        });
        return res.status(500).json({
          error: "Analysis failed",
          details: stderr,
        });
      }

      try {
        const result = JSON.parse(stdout);
        io.emit("analysis:complete", { analysisId, userId, result });
        res.status(200).json({ analysisId, ...result });
      } catch (error) {
        console.error("Failed to parse Python output:", stdout);
        io.emit("analysis:error", {
          analysisId,
          userId,
          error: error.message,
        });
        res.status(500).json({
          error: "Failed to parse analysis results",
          details: error.message,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      // Clean up on error
      try {
        fs.rmSync(tempProjectDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("Failed to clean up temp directory:", cleanupErr);
      }

      console.error("Failed to start Python process:", error);
      io.emit("analysis:error", { analysisId, userId, error: error.message });
      res.status(500).json({
        error: "Failed to start analysis",
        details: error.message,
      });
    });
  } catch (error) {
    // Clean up on error
    try {
      fs.rmSync(tempProjectDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error("Failed to clean up temp directory:", cleanupErr);
    }

    console.error("Error in analyzeUploadedFile controller:", error.message);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};
