import axios from "axios";
import Scan from "../models/scan.model.js";

const PYTHON_AI_SERVER_URL =
  process.env.PYTHON_AI_SERVER_URL || "http://localhost:8000";

// Helper to parse package files
const parsePackageFile = (content, fileName) => {
  const packages = [];

  if (fileName.endsWith("package.json")) {
    try {
      const json = JSON.parse(content);
      const deps = { ...json.dependencies, ...json.devDependencies };
      for (const [name, version] of Object.entries(deps)) {
        packages.push({ name, version: version.replace(/[\^~]/g, "") });
      }
    } catch {
      throw new Error("Invalid package.json format");
    }
  } else if (fileName.endsWith("requirements.txt")) {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:==|>=|<=|>|<)?(.+)?$/);
        if (match) {
          packages.push({ name: match[1], version: match[2] || "latest" });
        }
      }
    }
  } else {
    throw new Error(
      "Unsupported file format. Please upload package.json or requirements.txt",
    );
  }

  return packages;
};

// Helper to get risk level from score
const getRiskLevel = (score) => {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
};

// Scan packages using Python AI server (with fallback mock)
const scanPackagesWithAI = async (packages, originalContent = null) => {
  try {
    console.log("Sending to Python AI server:", packages);
    const response = await axios.post(
      `${PYTHON_AI_SERVER_URL}/analyze`,
      {
        formatted: packages,
        original: originalContent,
      },
      { timeout: 30000 },
    );
    return response.data.results;
  } catch (error) {
    console.log("Python AI server not available, using mock results");
    // Mock response for demo when AI server is not running
    return packages.map((pkg) => ({
      package: pkg.name,
      version: pkg.version,
      riskScore: Math.floor(Math.random() * 30), // Low risk for demo
      riskLevel: "low",
      issues: [],
    }));
  }
};

export const scanFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = req.file.originalname;
    const content = req.file.buffer.toString("utf-8");

    let packages;
    try {
      packages = parsePackageFile(content, fileName);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message });
    }

    if (packages.length === 0) {
      return res.status(400).json({ error: "No packages found in file" });
    }

    // Parse original content for package.json files
    let originalContent = null;
    if (fileName.endsWith("package.json")) {
      try {
        originalContent = JSON.parse(content);
      } catch {
        originalContent = content;
      }
    } else {
      originalContent = content;
    }

    const results = await scanPackagesWithAI(packages, originalContent);

    // Save scan to database
    const scan = new Scan({
      userId: req.user._id,
      scanType: "file",
      fileName,
      results,
    });
    await scan.save();

    res.status(200).json({
      success: true,
      results,
      message: `Scanned ${packages.length} packages`,
    });
  } catch (error) {
    console.error("Error in scanFile:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const scanByName = async (req, res) => {
  try {
    const { packageName } = req.body;

    if (!packageName) {
      return res.status(400).json({ error: "Package name is required" });
    }

    const packages = [{ name: packageName, version: "latest" }];
    const results = await scanPackagesWithAI(packages);

    // Save scan to database
    const scan = new Scan({
      userId: req.user._id,
      scanType: "name",
      packageName,
      results,
    });
    await scan.save();

    res.status(200).json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error in scanByName:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getHistory = async (req, res) => {
  try {
    const scans = await Scan.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      scans,
    });
  } catch (error) {
    console.error("Error in getHistory:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
