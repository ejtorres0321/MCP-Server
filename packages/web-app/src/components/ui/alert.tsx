import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success";
}

function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border px-4 py-3 text-sm",
        {
          "border-gray-200 bg-gray-50 text-gray-800": variant === "default",
          "border-destructive/30 bg-destructive/10 text-destructive": variant === "destructive",
          "border-success/30 bg-success/10 text-green-800": variant === "success",
        },
        className
      )}
      {...props}
    />
  );
}

export { Alert };
