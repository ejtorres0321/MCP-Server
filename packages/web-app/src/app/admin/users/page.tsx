"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { UserTable } from "@/components/admin/user-table";
import { listUsers } from "@/actions/admin-actions";
import Link from "next/link";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  isApproved: boolean;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await listUsers();
      if (result.success && result.users) {
        setUsers(result.users);
      } else {
        setError(result.error || "Failed to load users");
      }
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const pendingCount = users.filter((u) => !u.isApproved).length;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">User Management</h2>
          <p className="text-sm text-muted">
            Approve or reject user registrations
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium transition-colors hover:bg-gray-50 h-10"
          >
            Back to Dashboard
          </Link>
          <Button variant="secondary" onClick={fetchUsers} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50/50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-yellow-800">
              {pendingCount} user{pendingCount !== 1 ? "s" : ""} pending approval
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      {!loading && !error && <UserTable users={users} onRefresh={fetchUsers} />}
    </div>
  );
}
