// api/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import mongoose from "mongoose";

dotenv.config();

// === CONNECT TO MONGODB ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();
app.use(express.json());

const allowedOrigins = [
  "https://quickcart-frontend-mu.vercel.app", // deployed frontend
  "http://localhost:5173", // local dev
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// === SCHEMAS ===
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  description: String,
  createdAt: { type: Date, default: Date.now },
});

const Product = mongoose.model("Product", productSchema);

const orderSchema = new mongoose.Schema({
  userId: String,
  items: Array,
  total: Number,
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);

// === TEMPORARY RESET CODE STORE ===
const resetCodes = new Map();

// === ROUTES ===

// Root
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "QuickCart API is running!",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from QuickCart API! Server is working." });
});

// === PRODUCTS ===
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// === REGISTER ===
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "All fields are required" });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: { name: user.name, email: user.email },
      message: "Account created successfully!",
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// === LOGIN ===
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Please fill out all fields" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: { name: user.name, email: user.email },
      message: "Login successful!",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// === CONTACT ===
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "All fields are required" });

  console.log("Contact form:", { name, email, message });
  res.json({ success: true, message: "Thank you for your message! We will get back to you soon." });
});

// === PLACE ORDER ===
app.post("/api/orders", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { items, total } = req.body;

    const order = new Order({
      userId: decoded.id,
      items,
      total,
    });

    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    console.error("Place order error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
});

// === GET MY ORDERS ===
app.get("/api/orders", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const orders = await Order.find({ userId: decoded.id });
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Get orders error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
});

// === FORGOT PASSWORD ===
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "No account found" });

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(email, code);

  if (process.env.RENDER) {
  console.log(`📧 Email sending disabled on Render. Reset code: ${code}`);
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: `"QuickCart Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "QuickCart Password Reset Code",
    text: `Your verification code is: ${code}`,
  });
}


    console.log(`Password reset code for ${email}: ${code}`);
    res.json({ success: true, message: "Verification code sent to email." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to send code" });
  }
});

// === RESET PASSWORD ===
app.post("/api/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: "All fields are required" });

  const validCode = resetCodes.get(email);
  if (!validCode || validCode !== code) return res.status(400).json({ error: "Invalid or expired code" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    resetCodes.delete(email);
    res.json({ success: true, message: "Password reset successful!" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Error resetting password" });
  }
});

// === START SERVER ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
