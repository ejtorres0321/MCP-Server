import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MfaCode } from "@/lib/models/mfa-code";
import { sendMfaEmail } from "@/lib/mailtrap";

export async function POST() {
  console.log("[MFA Send] Route hit");

  try {
    const session = await auth();
    console.log("[MFA Send] Session:", session?.user?.id ? `User ${session.user.email}` : "NO SESSION");

    if (!session?.user?.id) {
      console.log("[MFA Send] Returning 401 - not authenticated");
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    await connectDB();
    console.log("[MFA Send] DB connected");

    // Invalidate any existing unused MFA codes for this user
    const deleted = await MfaCode.deleteMany({
      userId: session.user.id,
      usedAt: null,
    });
    console.log("[MFA Send] Deleted old codes:", deleted.deletedCount);

    // Generate 6-digit code
    const plainCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("[MFA Send] Generated code for", session.user.email);

    // Hash the code before storing
    const hashedCode = await bcrypt.hash(plainCode, 10);

    // Save to database with 10-minute expiry
    await MfaCode.create({
      userId: session.user.id,
      code: hashedCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
    });
    console.log("[MFA Send] Code saved to DB");

    // Send email with plaintext code
    console.log("[MFA Send] Calling Mailtrap API...");
    await sendMfaEmail(session.user.email!, plainCode);
    console.log("[MFA Send] Email sent successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MFA Send] ERROR:", error);
    return NextResponse.json(
      { error: "Failed to send MFA code" },
      { status: 500 }
    );
  }
}
