"use client";

import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { MfaForm } from "@/components/forms/mfa-form";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 3);
  return `${visible}***@${domain}`;
}

export default function VerifyMfaPage() {
  const { data: session } = useSession();
  const email = session?.user?.email;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Verify Your Identity</CardTitle>
          <CardDescription>
            {email
              ? `We sent a 6-digit code to ${maskEmail(email)}. Enter it below to continue.`
              : "We're sending a 6-digit code to your email. Enter it below to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MfaForm />
        </CardContent>
      </Card>
    </div>
  );
}
