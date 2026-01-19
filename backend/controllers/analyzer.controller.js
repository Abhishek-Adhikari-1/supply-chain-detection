import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { io } from "../socket/socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use environment variable for Python path, or fallback to venv/system python3
const PYTHON_CMD =
  process.env.PYTHON_PATH ||
  (fs.existsSync(path.join(__dirname, "../../.venv/bin/python3"))
    ? path.join(__dirname, "../../.venv/bin/python3")
    : "python3");

// Helper function to validate and sanitize paths
function validateProjectPath(inputPath, projectRoot) {
  // Normalize the path to remove .. and .
  const resolvedPath = path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.normalize(path.join(projectRoot, inputPath));

  // Ensure the resolved path is within the project root or is an absolute safe path
  const isWithinRoot = resolvedPath.startsWith(path.normalize(projectRoot));
  const isValidAbsolute =
    path.isAbsolute(inputPath) && fs.existsSync(resolvedPath);

  if (!isWithinRoot && !isValidAbsolute) {
    throw new Error("Invalid path: Path traversal detected");
  }

  return resolvedPath;
}

export const analyzeProject = async (req, res) => {
  try {
    const { projectPath, analysisId: clientAnalysisId } = req.body;

    const analysisId = clientAnalysisId || crypto.randomUUID();
    const userId = req.user?._id?.toString();

    if (!projectPath) {
      return res.status(400).json({ error: "Project path is required" });
    }

    const scriptPath = path.join(__dirname, "../../scanner_predictor.py");

    // Resolve and validate path to prevent directory traversal attacks
    const projectRoot = path.join(__dirname, "../..");
    const resolvedProjectPath = validateProjectPath(projectPath, projectRoot);

    const pythonProcess = spawn(PYTHON_CMD, [scriptPath, resolvedProjectPath]);

    // Emit to user-specific room if userId exists, otherwise broadcast
    if (userId) {
      io.to(`user:${userId}`).emit("analysis:start", {
        analysisId,
        userId,
        projectPath: resolvedProjectPath,
        source: "project",
      });
    } else {
      io.emit("analysis:start", {
        analysisId,
        userId,
        projectPath: resolvedProjectPath,
        source: "project",
      });
    }

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
      if (userId) {
        io.to(`user:${userId}`).emit("analysis:error", {
          analysisId,
          userId,
          error: error.message,
        });
      } else {
        io.emit("analysis:error", { analysisId, userId, error: error.message });
      }
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

    // Emit to user-specific room if userId exists, otherwise broadcast
    if (userId) {
      io.to(`user:${userId}`).emit("analysis:start", {
        analysisId,
        userId,
        projectPath: tempProjectDir,
        source: "upload",
      });
    } else {
      io.emit("analysis:start", {
        analysisId,
        userId,
        projectPath: tempProjectDir,
        source: "upload",
      });
    }

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
      if (userId) {
        io.to(`user:${userId}`).emit("analysis:error", {
          analysisId,
          userId,
          error: error.message,
        });
      } else {
        io.emit("analysis:error", { analysisId, userId, error: error.message });
      }
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

export const sandboxTest = async (req, res) => {
  try {
    const { packagePath, packageType = "npm", timeout = 30 } = req.body;
    const sandboxId = crypto.randomUUID();
    const userId = req.user?._id?.toString();

    if (!packagePath) {
      return res.status(400).json({ error: "Package path is required" });
    }

    const projectRoot = path.join(__dirname, "../..");
    const resolvedPackagePath = validateProjectPath(packagePath, projectRoot);

    // Check if package path exists
    if (!fs.existsSync(resolvedPackagePath)) {
      return res.status(404).json({ error: "Package not found" });
    }

    // Emit sandbox start event
    if (userId) {
      io.to(`user:${userId}`).emit("sandbox:start", {
        sandboxId,
        userId,
        packagePath: resolvedPackagePath,
        packageType,
        timeout,
      });
    } else {
      io.emit("sandbox:start", {
        sandboxId,
        userId,
        packagePath: resolvedPackagePath,
        packageType,
        timeout,
      });
    }

    // Create Python script to run sandbox controller
    const sandboxScript = `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, "../../sandbox").replace(/\\/g, "/")}')
from sandbox_controller import SandboxController

controller = SandboxController()
result = controller.test_package(
    package_path='${resolvedPackagePath.replace(/\\/g, "/")}',
    package_type='${packageType}',
    timeout=${timeout}
)
print(json.dumps(result))
`;

    // Write temp script
    const tempScriptPath = path.join(os.tmpdir(), `sandbox_${sandboxId}.py`);
    fs.writeFileSync(tempScriptPath, sandboxScript);

    const pythonProcess = spawn(PYTHON_CMD, [tempScriptPath]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;

      // Emit progress updates
      const roomTarget = userId ? `user:${userId}` : null;
      const emitFn = roomTarget ? io.to(roomTarget) : io;
      emitFn.emit("sandbox:log", {
        sandboxId,
        userId,
        chunk,
        stream: "stdout",
      });
    });

    pythonProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;

      const roomTarget = userId ? `user:${userId}` : null;
      const emitFn = roomTarget ? io.to(roomTarget) : io;
      emitFn.emit("sandbox:log", {
        sandboxId,
        userId,
        chunk,
        stream: "stderr",
      });
    });

    pythonProcess.on("close", (code) => {
      // Clean up temp script
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      if (code !== 0) {
        console.error("Sandbox stderr:", stderr);
        const roomTarget = userId ? `user:${userId}` : null;
        const emitFn = roomTarget ? io.to(roomTarget) : io;
        emitFn.emit("sandbox:error", {
          sandboxId,
          userId,
          error: stderr || "Sandbox test failed",
        });
        return res.status(500).json({
          error: "Sandbox test failed",
          details: stderr,
        });
      }

      try {
        let results;
        try {
          results = JSON.parse(stdout);
        } catch (e) {
          const jsonStartIndex = stdout.indexOf("{");
          const jsonEndIndex = stdout.lastIndexOf("}");
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            results = JSON.parse(
              stdout.substring(jsonStartIndex, jsonEndIndex + 1),
            );
          } else {
            throw e;
          }
        }

        // Emit completion event
        const roomTarget = userId ? `user:${userId}` : null;
        const emitFn = roomTarget ? io.to(roomTarget) : io;
        emitFn.emit("sandbox:complete", {
          sandboxId,
          userId,
          results,
        });

        res.json({
          success: true,
          sandboxId,
          ...results,
        });
      } catch (parseError) {
        console.error("Failed to parse sandbox results:", parseError);
        console.error("Stdout was:", stdout);
        res.status(500).json({
          error: "Failed to parse sandbox results",
          details: parseError.message,
        });
      }
    });
  } catch (error) {
    console.error("Sandbox test error:", error);
    res.status(500).json({
      error: "Sandbox test failed",
      details: error.message,
    });
  }
};
