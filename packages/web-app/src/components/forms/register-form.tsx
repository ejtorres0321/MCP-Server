"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { registerUser } from "@/actions/auth-actions";

export function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");
    setErrors({});
    setLoading(true);

    // Client-side email domain check
    if (!formData.email.endsWith("@manuelsolis.com")) {
      setErrors({ email: "Only @manuelsolis.com email addresses are allowed" });
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      setLoading(false);
      return;
    }

    try {
      const result = await registerUser(formData);

      if (!result.success) {
        setGlobalError(result.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Redirect to login with success message
      router.push("/login?registered=true");
    } catch {
      setGlobalError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {globalError && <Alert variant="destructive">{globalError}</Alert>}

      <Input
        id="name"
        label="Full Name"
        type="text"
        placeholder="Your full name"
        value={formData.name}
        onChange={(e) => updateField("name", e.target.value)}
        error={errors.name}
        required
        autoComplete="name"
        disabled={loading}
      />

      <Input
        id="email"
        label="Email"
        type="email"
        placeholder="you@manuelsolis.com"
        value={formData.email}
        onChange={(e) => updateField("email", e.target.value)}
        error={errors.email}
        required
        autoComplete="email"
        disabled={loading}
      />

      <Input
        id="password"
        label="Password"
        type="password"
        placeholder="Min. 8 characters"
        value={formData.password}
        onChange={(e) => updateField("password", e.target.value)}
        error={errors.password}
        required
        autoComplete="new-password"
        disabled={loading}
      />

      <Input
        id="confirmPassword"
        label="Confirm Password"
        type="password"
        placeholder="Repeat your password"
        value={formData.confirmPassword}
        onChange={(e) => updateField("confirmPassword", e.target.value)}
        error={errors.confirmPassword}
        required
        autoComplete="new-password"
        disabled={loading}
      />

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Create Account
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline font-medium">
          Sign In
        </Link>
      </p>
    </form>
  );
}
