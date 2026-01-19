import express from "express";
import {
  analyzeProject,
  analyzeUploadedFile,
  sandboxTest,
} from "../controllers/analyzer.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/project", protectRoute, analyzeProject);
router.post(
  "/upload",
  protectRoute,
  upload.single("file"),
  analyzeUploadedFile,
);
router.post("/sandbox", protectRoute, sandboxTest);

export default router;
