// api/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import { Resend } from 'resend'; // <-- ADDED: Resend import

dotenv.config();

// === RESEND: Initialize only if API key exists (safe for local & Render) ===
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// === CONNECT TO MONGODB ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const app = express();
app.use(express.json());

// === CORS ===
const allowedOrigins = [
  "https://quickcart-frontend-mu.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
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
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ error: "All fields are required" });

  try {
    let emailSent = false;

    // === RESEND: Try first (HTTPS, no port issues) ===
    if (resend) {
      try {
        await resend.emails.send({
          from: 'Contact Form <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL || 'hermelagetachew999@gmail.com',
          reply_to: email,
          subject: `New Message from ${name}`,
          html: `
            <h3>New Contact Form Submission</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <blockquote style="background:#f9f9f9; padding:15px; border-left:4px solid #ccc;">
              ${message.replace(/\n/g, '<br>')}
            </blockquote>
          `,
        });
        console.log(`Resend: Contact form email sent`);
        emailSent = true;
      } catch (e) {
        console.error("Resend contact error:", e.message);
      }
    }

    // === FALLBACK: Gmail/Nodemailer (original) ===
    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });

      await transporter.sendMail({
        from: `"${name}" <${email}>`,
        to: process.env.EMAIL_USER,
        subject: `New Contact Form Message`,
        text: message
      });
      console.log(`Gmail: Contact form email sent`);
      emailSent = true;
    }

    if (!emailSent) {
      console.log(`Contact email not sent. Message: ${message}`);
    }

    console.log("Contact form:", { name, email, message });
    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
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

    let emailSent = false;

    // === RESEND: Try first (HTTPS, no port issues) ===
    if (resend) {
      try {
        await resend.emails.send({
          from: 'QuickCart <onboarding@resend.dev>',
          to: email,
          subject: 'QuickCart Password Reset Code',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>Your verification code is:</p>
              <h1 style="background: #f0f0f0; padding: 15px; border-radius: 8px; text-align: center; letter-spacing: 3px; font-size: 28px;">
                ${code}
              </h1>
              <p>This code expires in <strong>10 minutes</strong>.</p>
              <p>If you didn't request this, ignore this email.</p>
            </div>
          `,
        });
        console.log(`Resend: Password reset code sent to ${email}`);
        emailSent = true;
      } catch (resendErr) {
        console.error("Resend failed:", resendErr.message);
      }
    }

    // === FALLBACK: Gmail/Nodemailer (original) ===
    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
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

      console.log(`Gmail: Password reset code sent to ${email}`);
      emailSent = true;
    }

    if (!emailSent) {
      console.log(`Reset code not sent (no service). Code: ${code}`);
    }

    res.json({ success: true, message: "Verification code sent to email." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to send code" });
  }
});

// === RESET PASSWORD ===
app.post("/api/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return res.status(400).json({ error: "All fields are required" });

  const validCode = resetCodes.get(email);
  if (!validCode || validCode !== code)
    return res.status(400).json({ error: "Invalid or expired code" });

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
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));