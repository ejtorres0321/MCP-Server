"use server";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";

interface ActionResult {
  success: boolean;
  error?: string;
}

interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  isApproved: boolean;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

interface ListUsersResult {
  success: boolean;
  users?: UserListItem[];
  error?: string;
}

async function requireAdmin() {
  const session = await auth();
  if (
    !session?.user?.id ||
    !session.user.mfaVerified ||
    !session.user.isApproved ||
    session.user.role !== "admin"
  ) {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

export async function listUsers(): Promise<ListUsersResult> {
  try {
    await requireAdmin();
    await connectDB();

    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      users: users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        role: u.role,
        isApproved: u.isApproved,
        createdAt: u.createdAt.toISOString(),
        approvedAt: u.approvedAt?.toISOString(),
        approvedBy: u.approvedBy || undefined,
      })),
    };
  } catch (error) {
    console.error("[Admin] listUsers error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list users",
    };
  }
}

export async function approveUser(userId: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.isApproved) {
      return { success: false, error: "User is already approved" };
    }

    user.isApproved = true;
    user.approvedAt = new Date();
    user.approvedBy = session.user.email || session.user.id;
    await user.save();

    return { success: true };
  } catch (error) {
    console.error("[Admin] approveUser error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve user",
    };
  }
}

export async function rejectUser(userId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.role === "admin") {
      return { success: false, error: "Cannot delete admin users" };
    }

    await User.deleteOne({ _id: userId });

    return { success: true };
  } catch (error) {
    console.error("[Admin] rejectUser error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject user",
    };
  }
}
