// test-email.js
import express from 'express';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

app.get('/', (req, res) => {
  res.send('Email test server is running!');
});

app.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Testing email to:', email);
    
    const result = await resend.emails.send({
      from: 'Test <onboarding@resend.dev>',
      to: [email],
      subject: 'Test Email',
      text: 'This is a test email from Resend!'
    });
    
    console.log('✅ Email sent:', result);
    res.json({ success: true, message: 'Email sent!', result });
  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});