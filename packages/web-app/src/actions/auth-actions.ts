"use server";

import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";
import { registerSchema } from "@/lib/validations";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function registerUser(formData: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  try {
    const parsed = registerSchema.safeParse(formData);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || "Invalid input",
      };
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email: parsed.data.email });
    if (existingUser) {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    // Create user (not approved by default)
    await User.create({
      email: parsed.data.email,
      password: hashedPassword,
      name: parsed.data.name,
      role: "user",
      isApproved: false,
    });

    return { success: true };
  } catch (error) {
    console.error("[Register] Error:", error);
    return {
      success: false,
      error: "Registration failed. Please try again.",
    };
  }
}
