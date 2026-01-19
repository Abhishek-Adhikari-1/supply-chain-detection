import jwt from "jsonwebtoken";
import { users } from "../controllers/auth.controller.js";

export const protectRoute = (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );
    const user = users.find((u) => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};
