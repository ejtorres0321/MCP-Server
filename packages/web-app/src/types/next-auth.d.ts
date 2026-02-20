import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      isApproved: boolean;
      mfaVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "user" | "admin";
    isApproved: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "user" | "admin";
    isApproved: boolean;
    mfaVerified: boolean;
  }
}
