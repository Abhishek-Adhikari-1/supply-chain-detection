import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const analyzeProject = async (req, res) => {
  try {
    const { projectPath } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: "Project path is required" });
    }

    const scriptPath = path.join(__dirname, "../../scanner_predictor.py");
    const resolvedProjectPath = path.resolve(projectPath);

    const pythonProcess = spawn("python3", [scriptPath, resolvedProjectPath]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Python stderr:", stderr);
        return res.status(500).json({
          error: "Analysis failed",
          details: stderr,
        });
      }

      try {
        const result = JSON.parse(stdout);
        res.status(200).json(result);
      } catch (error) {
        console.error("Failed to parse Python output:", stdout);
        res.status(500).json({
          error: "Failed to parse analysis results",
          details: error.message,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error("Failed to start Python process:", error);
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
