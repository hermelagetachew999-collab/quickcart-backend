import React, { useState } from "react";

export default function ForgetPasswordModal({ initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const validateEmail = (value) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value).toLowerCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    // Validation: non-empty and correct format
    if (!email || !email.trim()) {
      setError("Email is required");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address (example@domain.com)");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`⚠️ ${data.error || "Failed to request reset code"}`);
        setLoading(false);
        return;
      }

      if (data.resetCode) {
        setStatus(`✅ Reset code (dev): ${data.resetCode}`);
      } else if (data.emailSent) {
        setStatus("✅ Reset code sent to your email.");
      } else {
        setStatus("✅ Reset process initiated. Check your email.");
      }

      setStep(2);
    } catch (err) {
      setStatus("⚠️ Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forget-password-modal">
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="fp-email">Email</label>
        <input
          id="fp-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@domain.com"
          aria-invalid={!!error}
          aria-describedby="fp-email-error"
        />
        {error && (
          <div id="fp-email-error" style={{ color: "#b00020", marginTop: 6 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? "Sending..." : "Send reset code"}
        </button>

        {status && <div style={{ marginTop: 10 }}>{status}</div>}
      </form>
    </div>
  );
}
