"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { approveUser, rejectUser } from "@/actions/admin-actions";

interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  isApproved: boolean;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

interface UserTableProps {
  users: User[];
  onRefresh: () => void;
}

export function UserTable({ users, onRefresh }: UserTableProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleApprove(userId: string, name: string) {
    setError("");
    setSuccess("");
    setLoadingAction(userId);

    try {
      const result = await approveUser(userId);
      if (result.success) {
        setSuccess(`${name} has been approved`);
        onRefresh();
      } else {
        setError(result.error || "Failed to approve user");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject(userId: string, name: string) {
    if (!confirm(`Are you sure you want to reject and remove ${name}? This cannot be undone.`)) {
      return;
    }

    setError("");
    setSuccess("");
    setLoadingAction(userId);

    try {
      const result = await rejectUser(userId);
      if (result.success) {
        setSuccess(`${name} has been removed`);
        onRefresh();
      } else {
        setError(result.error || "Failed to reject user");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoadingAction(null);
    }
  }

  const pendingUsers = users.filter((u) => !u.isApproved);
  const approvedUsers = users.filter((u) => u.isApproved);

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Pending users */}
      {pendingUsers.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase text-muted">
            Pending Approval ({pendingUsers.length})
          </h3>
          <div className="overflow-auto rounded-lg border border-yellow-200 bg-yellow-50/50">
            <table className="min-w-full divide-y divide-yellow-200">
              <thead className="bg-yellow-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Registered</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yellow-100 bg-white">
                {pendingUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {new Date(user.createdAt).toISOString().split("T")[0]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(user.id, user.name)}
                          loading={loadingAction === user.id}
                          disabled={loadingAction !== null}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(user.id, user.name)}
                          disabled={loadingAction !== null}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All users */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted">
          All Users ({users.length})
        </h3>
        <div className="overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Approved By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {approvedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {user.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Badge variant={user.role === "admin" ? "success" : "default"}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Badge variant="success">Approved</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {user.approvedBy || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {user.approvedAt
                      ? new Date(user.approvedAt).toISOString().split("T")[0]
                      : user.createdAt
                        ? new Date(user.createdAt).toISOString().split("T")[0]
                        : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
