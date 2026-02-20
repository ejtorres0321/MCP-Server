import { NextRequest, NextResponse } from "next/server";
import { executeNaturalLanguageQuery } from "@/actions/ai-query-action";
import { auth } from "@/lib/auth";

// Allow up to 5 minutes for long-running queries (Tier 1 + Tier 2 + MCP)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id || !session.user.mfaVerified || !session.user.isApproved) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const prompt = body?.prompt;
    const conversationHistory = Array.isArray(body?.conversationHistory) ? body.conversationHistory : [];

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Please provide a prompt" },
        { status: 400 }
      );
    }

    const result = await executeNaturalLanguageQuery(prompt, conversationHistory);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API /query] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
