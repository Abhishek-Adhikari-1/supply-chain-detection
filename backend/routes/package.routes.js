import express from "express";
import multer from "multer";
import {
  scanFile,
  scanByName,
  getHistory,
} from "../controllers/package.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/json", "text/plain"];
    const allowedExtensions = [".json", ".txt"];
    const ext = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only package.json and requirements.txt files are allowed"));
    }
  },
});

// All routes are protected
router.use(protectRoute);

router.post("/scan-file", upload.single("file"), scanFile);
router.post("/scan-name", scanByName);
router.get("/history", getHistory);

export default router;
