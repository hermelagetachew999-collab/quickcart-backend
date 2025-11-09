import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://quickcart-frontend-mu.vercel.app",
      "http://localhost:5173"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const users = [];
const products = [
  { id: 1, name: "Wireless Headphones", price: 99.99, image: "/images/headphones.jpg", description: "High-quality wireless headphones with noise cancellation" },
  { id: 2, name: "Smart Watch", price: 199.99, image: "/images/smartwatch.jpg", description: "Feature-rich smartwatch with health monitoring" },
  { id: 3, name: "Laptop Backpack", price: 49.99, image: "/images/backpack.jpg", description: "Durable laptop backpack with USB charging port" },
  { id: 4, name: "Bluetooth Speaker", price: 79.99, image: "/images/speaker.jpg", description: "Portable Bluetooth speaker with amazing sound quality" }
];

const resetCodes = new Map();

// Root route
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "QuickCart API is running!",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from QuickCart API! Server is working." });
});

// Get products
app.get("/api/products", (req, res) => res.json({ success: true, products }));

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });
  if (users.find(u => u.email === email)) return res.status(400).json({ error: "User already exists" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = { id: users.length + 1, name, email, password: hashed, createdAt: new Date().toISOString() };
    users.push(user);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "fallback-secret", { expiresIn: "7d" });
    res.json({ success: true, token, user: { name: user.name, email: user.email }, message: "Account created successfully!" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Please fill out all fields" });

  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  try {
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "fallback-secret", { expiresIn: "7d" });
    res.json({ success: true, token, user: { name: user.name, email: user.email }, message: "Login successful!" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
});

// Contact
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "All fields are required" });

  console.log("Contact form:", { name, email, message });
  res.json({ success: true, message: "Thank you for your message! We will get back to you soon." });
});

// Forgot password
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "No account found with this email" });

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(email, code);

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
      await transporter.sendMail({ from: `"QuickCart Support" <${process.env.EMAIL_USER}>`, to: email, subject: "QuickCart Password Reset Code", text: `Your verification code is: ${code}` });
    }

    console.log(`Password reset code for ${email}: ${code}`);
    res.json({ success: true, message: "Verification code sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to send code. Try again later." });
  }
});

// Reset password
app.post("/api/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: "All fields are required" });

  const validCode = resetCodes.get(email);
  if (!validCode || validCode !== code) return res.status(400).json({ error: "Invalid or expired code" });

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    user.password = await bcrypt.hash(newPassword, 10);
    resetCodes.delete(email);
    res.json({ success: true, message: "Password reset successful!" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Error resetting password" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

