import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/forms/login-form";
import { Alert } from "@/components/ui/alert";

interface LoginPageProps {
  searchParams: Promise<{ registered?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Law Office of Manuel Solis</CardTitle>
          <CardDescription>Database Console — Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {params.registered === "true" && (
            <div className="mb-4">
              <Alert variant="success">
                Account created successfully! Your account is pending admin approval.
                You will be notified when your account is activated.
              </Alert>
            </div>
          )}
          {params.error === "not-approved" && (
            <div className="mb-4">
              <Alert variant="default">
                Your account is pending approval. Please contact an administrator.
              </Alert>
            </div>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
