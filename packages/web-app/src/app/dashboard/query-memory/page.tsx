"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { listRememberedQueries, forgetQuery } from "@/actions/query-memory-actions";
import type { IRememberedQuery } from "@/types";
import { Button } from "@/components/ui/button";

export default function QueryMemoryPage() {
  const [queries, setQueries] = useState<IRememberedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadQueries = useCallback(async () => {
    setLoading(true);
    const result = await listRememberedQueries();
    setQueries(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await forgetQuery(id);
    if (result.success) {
      setQueries((prev) => prev.filter((q) => q._id !== id));
    }
    setDeletingId(null);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Query Memory</h1>
        <p className="mt-1 text-sm text-gray-500">
          Remembered queries are injected into the AI system prompt to improve SQL generation for similar questions.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-500">
          Loading...
        </div>
      ) : queries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            No remembered queries yet. Use the &quot;Remember&quot; button on successful queries in the dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queries.map((q) => (
            <div
              key={q._id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {q.naturalLanguage}
                  </p>
                  <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-[11px] text-gray-600">
                    {q.generatedSQL}
                  </pre>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium">
                      {q.category}
                    </span>
                    <span>Tier {q.tier}</span>
                    {q.tables.length > 0 && (
                      <span>Tables: {q.tables.join(", ")}</span>
                    )}
                    <span>by {q.rememberedByName}</span>
                    <span>
                      {new Date(q.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(q._id)}
                  disabled={deletingId === q._id}
                  className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {deletingId === q._id ? "..." : "Delete"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
