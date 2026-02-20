import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { encode, decode } from "next-auth/jwt";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MfaCode } from "@/lib/models/mfa-code";
import { mfaSchema } from "@/lib/validations";

// Determine cookie name based on environment
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
const COOKIE_NAME = useSecureCookies
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = mfaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid code" },
        { status: 400 }
      );
    }

    await connectDB();

    // Find the most recent unused, non-expired code for this user
    const mfaCode = await MfaCode.findOne({
      userId: session.user.id,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!mfaCode) {
      return NextResponse.json(
        { error: "No valid MFA code found. Please request a new one." },
        { status: 400 }
      );
    }

    // Check attempt limit
    if (mfaCode.attempts >= 5) {
      await MfaCode.deleteOne({ _id: mfaCode._id });
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 429 }
      );
    }

    // Increment attempts
    mfaCode.attempts += 1;
    await mfaCode.save();

    // Verify code
    const isValid = await bcrypt.compare(parsed.data.code, mfaCode.code);

    if (!isValid) {
      const remaining = 5 - mfaCode.attempts;
      return NextResponse.json(
        { error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` },
        { status: 400 }
      );
    }

    // Mark code as used
    mfaCode.usedAt = new Date();
    await mfaCode.save();

    // Directly update the JWT cookie with mfaVerified: true
    // This ensures the middleware sees the updated token on the very next request
    const secret = process.env.NEXTAUTH_SECRET!;
    const cookieStore = await cookies();
    const existingToken = cookieStore.get(COOKIE_NAME)?.value;

    if (existingToken) {
      const decoded = await decode({ token: existingToken, secret, salt: COOKIE_NAME });

      if (decoded) {
        decoded.mfaVerified = true;

        const newToken = await encode({
          token: decoded,
          secret,
          salt: COOKIE_NAME,
          maxAge: 8 * 60 * 60, // match session maxAge (8 hours)
        });

        cookieStore.set(COOKIE_NAME, newToken, {
          httpOnly: true,
          secure: useSecureCookies,
          sameSite: "lax",
          path: "/",
          maxAge: 8 * 60 * 60,
        });

        console.log("[MFA Verify] JWT cookie updated with mfaVerified: true");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MFA Verify] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify MFA code" },
      { status: 500 }
    );
  }
}
