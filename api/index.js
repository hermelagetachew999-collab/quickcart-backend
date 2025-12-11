// api/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import { Resend } from 'resend';

dotenv.config();

// === RESEND: Initialize only if API key exists ===
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// === CONNECT TO MONGODB ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();
app.use(express.json());

// === SIMPLE CORS ===
app.use(cors({
  origin: ["https://quickcart-frontend-mu.vercel.app", "http://localhost:5173"],
  credentials: true
}));

// === TEST PAGE ROUTE ===
app.get('/email-test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>QuickCart Email Test</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .section { margin: 30px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
            h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 0; }
            input, button { padding: 12px; margin: 10px 0; width: 100%; box-sizing: border-box; border-radius: 5px; }
            input { border: 1px solid #ddd; font-size: 16px; }
            button { background: #007bff; color: white; border: none; cursor: pointer; font-size: 16px; font-weight: bold; }
            button:hover { background: #0056b3; }
            .result { margin-top: 15px; padding: 15px; border-radius: 5px; font-family: monospace; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
            .note { background: #fff3cd; padding: 10px; border-radius: 5px; color: #856404; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔧 QuickCart Backend Email Test</h1>
            <div class="note">
                <strong>Note:</strong> This page tests your backend API endpoints directly.
                Backend URL: <strong id="apiUrl"></strong>
            </div>
            
            <div class="section">
                <h2>1. Test Basic Email (Resend API)</h2>
                <input type="email" id="testEmail" placeholder="Enter your email" value="hermelagetachew999@gmail.com">
                <button onclick="sendTestEmail()">Send Test Email via Resend</button>
                <div id="testResult" class="result"></div>
            </div>

            <div class="section">
                <h2>2. Test Forgot Password Flow</h2>
                <input type="email" id="forgotEmail" placeholder="Enter registered email">
                <button onclick="testForgotPassword()">Test Forgot Password</button>
                <div id="forgotResult" class="result"></div>
            </div>

            <div class="section">
                <h2>3. Check Backend Configuration</h2>
                <button onclick="checkEnv()">Check Environment Variables</button>
                <pre id="envResult">Click to check...</pre>
            </div>
        </div>

        <script>
            const API_URL = window.location.origin;
            document.getElementById('apiUrl').textContent = API_URL;
            
            async function sendTestEmail() {
                const email = document.getElementById('testEmail').value;
                const resultDiv = document.getElementById('testResult');
                resultDiv.innerHTML = "<strong>Sending test email...</strong>";
                resultDiv.className = 'result';
                
                try {
                    const response = await fetch(API_URL + '/api/test-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        resultDiv.innerHTML = \`
                            <div class="success">
                                <strong>✅ Success!</strong><br>
                                Message: \${data.message}<br>
                                Email ID: \${data.emailId}<br>
                                Sent to: \${data.to}<br>
                                <em>Check your inbox (and spam folder)</em>
                            </div>
                        \`;
                        resultDiv.className = 'result success';
                    } else {
                        resultDiv.innerHTML = \`
                            <div class="error">
                                <strong>❌ Error</strong><br>
                                \${data.error || 'Unknown error'}<br>
                                \${data.details ? 'Details: ' + data.details : ''}
                            </div>
                        \`;
                        resultDiv.className = 'result error';
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="error">
                            <strong>❌ Network Error</strong><br>
                            \${error.message}<br>
                            Make sure backend is running at: \${API_URL}
                        </div>
                    \`;
                    resultDiv.className = 'result error';
                }
            }

            async function testForgotPassword() {
                const email = document.getElementById('forgotEmail').value || 'hermelagetachew999@gmail.com';
                const resultDiv = document.getElementById('forgotResult');
                resultDiv.innerHTML = "<strong>Processing forgot password request...</strong>";
                resultDiv.className = 'result';
                
                try {
                    const response = await fetch(API_URL + '/api/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        if (data.resetCode) {
                            resultDiv.innerHTML = \`
                                <div class="success">
                                    <strong>✅ Demo Mode Active</strong><br>
                                    <strong>Code:</strong> \${data.resetCode}<br>
                                    <strong>Message:</strong> \${data.message}<br>
                                    <strong>Note:</strong> \${data.note}<br>
                                    <em>Use this code in your frontend to test reset flow</em>
                                </div>
                            \`;
                        } else {
                            resultDiv.innerHTML = \`
                                <div class="success">
                                    <strong>✅ Email Sent!</strong><br>
                                    Service: \${data.serviceUsed}<br>
                                    Message: \${data.message}<br>
                                    <em>Check your email inbox</em>
                                </div>
                            \`;
                        }
                        resultDiv.className = 'result success';
                    } else {
                        resultDiv.innerHTML = \`
                            <div class="error">
                                <strong>❌ Error</strong><br>
                                \${data.error || 'Unknown error'}
                            </div>
                        \`;
                        resultDiv.className = 'result error';
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="error">
                            <strong>❌ Network Error</strong><br>
                            \${error.message}
                        </div>
                    \`;
                    resultDiv.className = 'result error';
                }
            }

            async function checkEnv() {
                const resultDiv = document.getElementById('envResult');
                resultDiv.innerHTML = "Checking backend status...";
                
                try {
                    const response = await fetch(API_URL + '/api');
                    const data = await response.json();
                    resultDiv.innerHTML = JSON.stringify(data, null, 2);
                } catch (error) {
                    resultDiv.innerHTML = \`Error: \${error.message}\`;
                }
            }
            
            // Auto-fill with your email
            document.addEventListener('DOMContentLoaded', function() {
                document.getElementById('forgotEmail').value = 'hermelagetachew999@gmail.com';
            });
        </script>
    </body>
    </html>
  `);
});

// === TEST RESEND ENDPOINT ===
app.post("/api/test-email", async (req, res) => {
  console.log("=== TEST EMAIL REQUEST ===");
  
  try {
    if (!resend) {
      console.log("❌ Resend not initialized");
      return res.status(500).json({ error: "Resend not configured" });
    }

    const { email } = req.body;
    const testEmail = email || process.env.ADMIN_EMAIL || "hermelagetachew999@gmail.com";
    
    console.log("📧 Testing email to:", testEmail);
    console.log("🔑 API Key exists:", !!process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: 'QuickCart Test <onboarding@resend.dev>',
      to: [testEmail],
      subject: 'Test Email from QuickCart API',
      text: 'This is a test email from your QuickCart backend!',
      html: '<h1>Test Email Success!</h1><p>If you can read this, your Resend configuration is working!</p>'
    });

    console.log("✅ Test email sent successfully!");
    console.log("Response:", result);

    res.json({ 
      success: true, 
      message: "Test email sent successfully!",
      emailId: result.id,
      to: testEmail
    });

  } catch (error) {
    console.error("❌ Test email failed:");
    console.error("Error:", error.message);
    console.error("Full error:", error);
    
    res.status(500).json({ 
      error: "Failed to send test email",
      details: error.message 
    });
  }
});

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

    // === RESEND: Try first ===
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
        console.log(`✅ Resend: Contact form email sent`);
        emailSent = true;
      } catch (e) {
        console.error("❌ Resend contact error:", e.message);
      }
    }

    // === FALLBACK: Gmail/Nodemailer ===
    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
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
        console.log(`✅ Gmail: Contact form email sent`);
        emailSent = true;
      } catch (e) {
        console.error("❌ Gmail contact error:", e.message);
      }
    }

    if (!emailSent) {
      console.log(`⚠️ Contact email not sent. Message: ${message}`);
    }

    console.log("📨 Contact form submission:", { name, email, message: message.substring(0, 50) });
    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("💥 Contact form error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// === FORGOT PASSWORD ===
app.post("/api/forgot-password", async (req, res) => {
  console.log("=== FORGOT PASSWORD REQUEST START ===");
  
  const { email } = req.body;
  if (!email) {
    console.log("❌ Missing email in request");
    return res.status(400).json({ error: "Email is required" });
  }

  console.log("🔍 Looking for user with email:", email);

  const user = await User.findOne({ email });
  if (!user) {
    console.log("❌ No user found with email:", email);
    return res.status(404).json({ error: "No account found" });
  }

  console.log("✅ User found:", user.email);

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(email, code);
    
    // Set expiration (10 minutes)
    setTimeout(() => {
      if (resetCodes.get(email) === code) {
        resetCodes.delete(email);
        console.log(`⌛ Reset code expired for ${email}`);
      }
    }, 10 * 60 * 1000);

    console.log(`📧 Generated reset code: ${code}`);

    // === CHECK RESEND CONFIGURATION ===
    console.log("🔧 Checking Resend configuration:");
    console.log("- API Key exists:", !!process.env.RESEND_API_KEY);
    console.log("- Resend object:", resend ? "Initialized" : "Not initialized");

    let emailSent = false;
    let emailService = "none";

    // === ATTEMPT RESEND ===
    if (resend && process.env.RESEND_API_KEY) {
      console.log("🔄 Attempting to send via Resend...");
      try {
        const result = await resend.emails.send({
          from: 'QuickCart <onboarding@resend.dev>',
          to: [email],
          subject: 'QuickCart Password Reset Code',
          text: `Your verification code is: ${code}`,
          html: `<p>Your verification code is: <strong>${code}</strong></p>`
        });
        
        console.log("✅ Resend API call successful!");
        console.log("📊 Resend response:", result);
        
        emailSent = true;
        emailService = "Resend";
        
      } catch (resendErr) {
        console.error("❌ Resend API error:", resendErr.message);
      }
    } else {
      console.log("⚠️ Resend not configured properly");
    }

    // === FALLBACK TO GMAIL ===
    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log("🔄 Attempting Gmail fallback...");
      try {
        console.log("📧 Using Gmail:", process.env.EMAIL_USER);
        
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { 
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS 
          },
        });

        const info = await transporter.sendMail({
          from: `"QuickCart" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'QuickCart Password Reset Code',
          text: `Your verification code is: ${code}`,
        });

        console.log("✅ Gmail sent:", info.messageId);
        emailSent = true;
        emailService = "Gmail";
        
      } catch (gmailErr) {
        console.error("❌ Gmail error:", gmailErr.message);
      }
    }

    // === FINAL RESULT ===
    console.log("📊 Final status:");
    console.log("- Email sent:", emailSent ? "✅ Yes" : "❌ No");
    console.log("- Service used:", emailService);

    if (!emailSent) {
      console.log("💡 DEMO MODE: Returning code directly");
      console.log(`💡 Code for ${email}: ${code}`);
      
      return res.json({ 
        success: true, 
        message: `Demo mode: Your reset code is ${code}`,
        resetCode: code,
        note: "In production, this would be emailed securely"
      });
    }

    res.json({ 
      success: true, 
      message: "Reset code sent! Check your email (and spam folder).",
      serviceUsed: emailService
    });

  } catch (err) {
    console.error("💥 Unexpected error in forgot-password:", err);
    res.status(500).json({ error: "Internal server error" });
  }
  
  console.log("=== FORGOT PASSWORD REQUEST END ===\n");
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

// === START SERVER ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📧 Test page: http://localhost:${PORT}/email-test`);
  console.log(`🔧 API status: http://localhost:${PORT}/api`);
});
app.get("/", (req, res) => {
  res.send("QuickCart API is running");
});
