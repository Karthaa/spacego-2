"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/navigation/Navbar";
import { authErrorMessage } from "@/lib/auth/messages";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import { Mail, Lock, AlertTriangle, LogOut } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas text-base text-ink-muted">
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signOut, user, hasSession, isLoading: authLoading } =
    useAuth();
  const { success, error: toastError } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const queryError = searchParams.get("error");
  const profileMissing =
    searchParams.get("reason") === "profile_missing" ||
    (hasSession && !user && !authLoading);
  const requestedRedirect = safeNextPath(searchParams.get("redirect"));
  const redirectTarget =
    requestedRedirect && !requestedRedirect.startsWith("/auth/")
      ? requestedRedirect
      : null;

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(redirectTarget ?? homeForRole(user.role));
    router.refresh();
  }, [authLoading, user, redirectTarget, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !password) {
      setFormError("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);

      if (result.error || !result.profile) {
        const message = result.error ?? "Unable to sign in.";
        setFormError(message);
        toastError("Sign In Failed", message);
        return;
      }

      success("Signed in successfully", "Welcome back to SpaceGo.");
      router.replace(redirectTarget ?? homeForRole(result.profile.role));
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-ink">
          Sign in to SpaceGo
        </h1>
        <p className="mt-2 text-center text-base text-ink-muted">
          Manage your bookings, listings and requests.
        </p>

        <Card elevation="raised" padding="lg" className="mt-8 space-y-6">
          {profileMissing && (
            <div className="flex items-start gap-3 rounded-md bg-warning-soft p-4">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-warning"
                aria-hidden="true"
              />
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-ink">
                  Your SpaceGo profile is missing
                </p>
                <p className="text-sm text-ink-muted">
                  You are signed in, but this account has no profile record.
                  Apply the profiles migration or contact support, or sign out
                  and try another account.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void signOut()}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </div>
          )}

          {(formError || queryError) && (
            <div
              role="alert"
              className="rounded-md bg-danger-soft p-3 text-sm font-medium text-danger"
            >
              {formError ?? authErrorMessage(queryError)}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail aria-hidden="true" />}
            />

            <div className="space-y-2">
              <Input
                label="Password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock aria-hidden="true" />}
              />
              <div className="flex justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="rounded-sm text-sm font-medium text-accent hover:text-accent-hover"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
            >
              Sign in
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-ink-muted">
          New to SpaceGo?{" "}
          <Link
            href="/auth/register"
            className="rounded-sm font-medium text-accent hover:text-accent-hover"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
