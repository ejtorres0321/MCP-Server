"use client";

interface BigNumberCardProps {
  label: string;
  value: string | number;
}

export function BigNumberCard({ label, value }: BigNumberCardProps) {
  const formatted =
    typeof value === "number" ? value.toLocaleString() : String(value);

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <p className="text-5xl font-bold text-primary">{formatted}</p>
      <p className="mt-3 text-sm font-medium uppercase tracking-wide text-muted">
        {label.replace(/_/g, " ")}
      </p>
    </div>
  );
}
