"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-primary">
            Manuel Solis
          </h1>
          <span className="text-sm text-muted">Database Console</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/query-memory"
            className="inline-flex items-center justify-center rounded-lg font-medium transition-colors hover:bg-gray-100 h-8 px-3 text-sm"
          >
            Query Memory
          </Link>
          {session?.user?.role === "admin" && (
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center rounded-lg font-medium transition-colors hover:bg-gray-100 h-8 px-3 text-sm"
            >
              Admin Panel
            </Link>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{session?.user?.name}</span>
            <Badge variant={session?.user?.role === "admin" ? "success" : "default"}>
              {session?.user?.role}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
