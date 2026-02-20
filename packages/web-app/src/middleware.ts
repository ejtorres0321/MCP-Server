import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require any authentication
const publicRoutes = ["/login", "/register"];

// Routes that require auth but not necessarily MFA or approval
const authOnlyRoutes = ["/verify-mfa", "/pending-approval"];

// Routes that require admin role
const adminRoutes = ["/admin"];

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthOnlyRoute = authOnlyRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isApiRoute = pathname.startsWith("/api");

  // Allow API routes to pass through (they handle their own auth)
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Decode JWT token (lightweight, no DB calls)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isAuthenticated = !!token;
  const isMfaVerified = token?.mfaVerified === true;
  const isApproved = token?.isApproved === true;
  const isAdmin = token?.role === "admin";

  // Debug: log token state for protected routes
  if (pathname === "/dashboard" || pathname.startsWith("/admin")) {
    console.log(`[Middleware] ${pathname} — auth:${isAuthenticated} mfa:${isMfaVerified} approved:${isApproved} admin:${isAdmin}`);
  }

  // Fully authenticated user visiting public/auth-only routes → redirect to dashboard
  if (isAuthenticated && isMfaVerified && isApproved) {
    if (isPublicRoute || isAuthOnlyRoute) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  // Public routes: allow unauthenticated, redirect authenticated+mfa users to dashboard
  if (isPublicRoute) {
    if (isAuthenticated && !isMfaVerified) {
      return NextResponse.redirect(new URL("/verify-mfa", nextUrl));
    }
    return NextResponse.next();
  }

  // All remaining routes require authentication
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Auth-only routes (verify-mfa, pending-approval): allow authenticated users
  if (isAuthOnlyRoute) {
    return NextResponse.next();
  }

  // Protected routes require MFA
  if (!isMfaVerified) {
    return NextResponse.redirect(new URL("/verify-mfa", nextUrl));
  }

  // Protected routes require approval
  if (!isApproved) {
    return NextResponse.redirect(new URL("/pending-approval", nextUrl));
  }

  // Admin routes require admin role
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
