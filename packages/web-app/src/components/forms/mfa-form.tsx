"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function MfaForm() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true); // starts true — sending on mount
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasSentRef = useRef(false);

  // Auto-send MFA code on mount
  useEffect(() => {
    if (hasSentRef.current) return;
    hasSentRef.current = true;

    async function sendInitialCode() {
      try {
        const response = await fetch("/api/mfa/send", { method: "POST" });
        if (!response.ok) {
          setError("Failed to send verification code. Please try resending.");
        } else {
          setResendCooldown(60);
        }
      } catch {
        setError("Failed to send verification code. Please try resending.");
      } finally {
        setSending(false);
        inputRefs.current[0]?.focus();
      }
    }

    sendInitialCode();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullCode = code.join("");

    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Verification failed");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // The /api/mfa/verify route already updated the JWT cookie with mfaVerified: true.
      // Use window.location for a full page load so the browser sends the updated cookie.
      window.location.href = "/dashboard";
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");

    try {
      const response = await fetch("/api/mfa/send", { method: "POST" });

      if (!response.ok) {
        setError("Failed to resend code. Please try again.");
      } else {
        setResendCooldown(60); // 60 second cooldown
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Failed to resend code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {sending && (
        <p className="text-center text-sm text-muted">Sending verification code to your email...</p>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="h-14 w-12 rounded-lg border border-gray-300 bg-white text-center text-2xl font-bold text-primary transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            disabled={loading || sending}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      <Button type="submit" className="w-full" size="lg" loading={loading} disabled={sending}>
        Verify Code
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className="text-sm text-accent hover:underline disabled:text-muted disabled:no-underline"
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : resending
              ? "Sending..."
              : "Resend code"}
        </button>
      </div>
    </form>
  );
}
