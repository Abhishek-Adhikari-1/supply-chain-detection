import express from "express";
import { analyzeProject } from "../controllers/analyzer.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/project", protectRoute, analyzeProject);

export default router;
