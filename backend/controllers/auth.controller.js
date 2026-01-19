import argon2 from "argon2";
import jwt from "jsonwebtoken";

// In-memory user store (replace with database in production)
const users = [];
const resetTokens = new Map();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "7d",
  });
};

export const signup = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await argon2.hash(password);

    const newUser = {
      id: Date.now().toString(),
      fullName,
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };

    users.push(newUser);

    const token = generateToken(newUser.id);

    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.status(201).json({
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isValidPassword = await argon2.verify(user.password, password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user.id);

    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.json({ message: "Logged out successfully" });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = users.find((u) => u.email === email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: "If an account exists, a reset link will be sent",
      });
    }

    // Generate reset token
    const resetToken = Math.random().toString(36).substring(2, 15);
    resetTokens.set(resetToken, {
      userId: user.id,
      expires: Date.now() + 3600000,
    }); // 1 hour

    // In production, send email with reset link
    console.log(`Reset token for ${email}: ${resetToken}`);

    res.json({ message: "If an account exists, a reset link will be sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const resetData = resetTokens.get(token);
    if (!resetData || resetData.expires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = users.find((u) => u.id === resetData.userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    user.password = await argon2.hash(password);
    resetTokens.delete(token);

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  res.json(req.user);
};

// Export users for middleware
export { users };
