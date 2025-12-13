const handleSubmit = async (e) => {
  e.preventDefault();
  setStatus("");
  setLoading(true);

  try {
    const response = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
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
    setLoading(false);
  } catch (err) {
    setStatus("⚠️ Network error. Try again.");
    setLoading(false);
  }
};