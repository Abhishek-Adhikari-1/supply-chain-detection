import axios from "axios";
import Scan from "../models/scan.model.js";

const PYTHON_AI_SERVER_URL =
  process.env.PYTHON_AI_SERVER_URL || "http://localhost:8000";

// Helper to parse package files
const parsePackageFile = (content, fileName) => {
  const packages = [];
  let metadata = {};

  if (fileName.endsWith("package.json")) {
    try {
      const json = JSON.parse(content);
      // Store metadata about the project
      metadata = {
        projectName: json.name || "unknown",
        projectVersion: json.version || "0.0.0",
        hasScripts: !!json.scripts,
        hasDevDeps: !!json.devDependencies,
        totalDeps: Object.keys(json.dependencies || {}).length,
        totalDevDeps: Object.keys(json.devDependencies || {}).length,
      };

      // Parse each dependency separately with context
      const deps = json.dependencies || {};
      const devDeps = json.devDependencies || {};

      for (const [name, version] of Object.entries(deps)) {
        packages.push({
          name,
          version: version.replace(/[\^~]/g, ""),
          isDev: false,
          ecosystem: "npm",
          projectContext: metadata,
        });
      }

      for (const [name, version] of Object.entries(devDeps)) {
        packages.push({
          name,
          version: version.replace(/[\^~]/g, ""),
          isDev: true,
          ecosystem: "npm",
          projectContext: metadata,
        });
      }
    } catch {
      throw new Error("Invalid package.json format");
    }
  } else if (fileName.endsWith("requirements.txt")) {
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:==|>=|<=|>|<)?(.+)?$/);
        if (match) {
          packages.push({
            name: match[1],
            version: match[2] || "latest",
            isDev: false,
            ecosystem: "pypi",
            projectContext: {},
          });
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
const scanPackagesWithAI = async (packages) => {
  try {
    console.log(`Sending ${packages.length} packages to Python AI server`);
    const response = await axios.post(
      `${PYTHON_AI_SERVER_URL}/analyze`,
      {
        packages: packages,
      },
      { timeout: 30000 },
    );
    return response.data.results;
  } catch (error) {
    console.log("Python AI server not available, using mock results");
    console.log("Error details:", error.message);
    // Mock response for demo when AI server is not running
    return packages.map((pkg) => ({
      package: pkg.name,
      version: pkg.version,
      riskScore: Math.floor(Math.random() * 50), // Random 0-50 for demo variety
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

    // Analyze packages (now contains metadata about each package)
    const results = await scanPackagesWithAI(packages);

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
      .limit(100);

    // Format the history data for frontend consumption
    const history = scans.map((scan) => {
      const firstResult = scan.results?.[0] || {};
      const totalIssues =
        scan.results?.reduce((sum, r) => sum + (r.issues?.length || 0), 0) || 0;
      const avgRiskScore =
        scan.results?.length > 0
          ? Math.round(
              scan.results.reduce((sum, r) => sum + (r.riskScore || 0), 0) /
                scan.results.length,
            )
          : 0;
      const highestRiskLevel =
        scan.results?.reduce((highest, r) => {
          const levels = ["low", "medium", "high", "critical"];
          const currentLevel = levels.indexOf(r.riskLevel || "low");
          const highestLevel = levels.indexOf(highest);
          return currentLevel > highestLevel ? r.riskLevel : highest;
        }, "low") || "low";

      return {
        _id: scan._id,
        packageName: scan.packageName || scan.projectPath || "Unknown",
        projectPath: scan.projectPath,
        riskScore: avgRiskScore,
        riskLevel: highestRiskLevel,
        issuesCount: totalIssues,
        scannedAt: scan.createdAt,
        scanType: scan.scanType === "name" ? "package" : scan.scanType,
        results: scan.results,
      };
    });

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Error in getHistory:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
