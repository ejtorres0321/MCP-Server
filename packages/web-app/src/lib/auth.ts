import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            return null;
          }

          await connectDB();

          const user = await User.findOne({ email: parsed.data.email });
          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(parsed.data.password, user.password);
          if (!isValid) {
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            isApproved: user.isApproved,
          };
        } catch (error) {
          console.error("[Auth] authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in: populate token from user object
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.isApproved = user.isApproved;
        token.mfaVerified = false;
      }

      // Session update trigger — refresh approval/role from DB
      if (trigger === "update") {
        try {
          await connectDB();
          const freshUser = await User.findById(token.id);
          if (freshUser) {
            token.isApproved = freshUser.isApproved;
            token.role = freshUser.role;
          }
          console.log("[Auth] JWT updated from DB:", { isApproved: token.isApproved, role: token.role });
        } catch (error) {
          console.error("[Auth] JWT update error:", error);
        }
      }

      // mfaVerified is set directly in the JWT cookie by /api/mfa/verify
      // and is preserved across token refreshes automatically
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.isApproved = token.isApproved;
      session.user.mfaVerified = token.mfaVerified;
      return session;
    },
  },
});
