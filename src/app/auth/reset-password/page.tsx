"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/navigation/Navbar";
import { Lock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ResetPasswordPage() {
  const { hasSession, isLoading, updatePassword, signOut } = useAuth();
  const { success, error: toastError } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Choose a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updatePassword(password);

      if (result.error) {
        setFormError(result.error);
        toastError("Password Update Failed", result.error);
        return;
      }

      setComplete(true);
      success("Password Updated", "Sign in with your new password.");
      await signOut();
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

        {complete ? (
          <Card elevation="raised" padding="lg" className="mt-8 text-center">
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-success-soft text-success"
            >
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
              Password updated
            </h1>
            <p className="mt-2 text-base text-ink-muted">
              Your password has been changed and you have been signed out. Sign
              in again with your new password.
            </p>
            <Link
              href="/auth/login"
              className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}
            >
              Continue to sign in
            </Link>
          </Card>
        ) : isLoading ? (
          <Card elevation="raised" padding="lg" className="mt-8">
            <p role="status" className="py-6 text-center text-base text-ink-muted">
              Checking your reset link…
            </p>
          </Card>
        ) : !hasSession ? (
          <Card elevation="raised" padding="lg" className="mt-8 text-center">
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-warning-soft text-warning"
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
              This link is invalid or has expired
            </h1>
            <p className="mt-2 text-base text-ink-muted">
              Request a new reset link and open it in the same browser.
            </p>
            <Link
              href="/auth/forgot-password"
              className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}
            >
              Request a new link
            </Link>
          </Card>
        ) : (
          <>
            <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-ink">
              Choose a new password
            </h1>
            <p className="mt-2 text-center text-base text-ink-muted">
              You&apos;ll be signed out afterwards so you can sign in with it.
            </p>

            <Card elevation="raised" padding="lg" className="mt-8 space-y-6">
              {formError && (
                <div
                  role="alert"
                  className="rounded-md bg-danger-soft p-3 text-sm font-medium text-danger"
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <Input
                  label="New password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText="At least 8 characters."
                  leftIcon={<Lock aria-hidden="true" />}
                />

                <Input
                  label="Confirm new password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock aria-hidden="true" />}
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  isLoading={isSubmitting}
                >
                  Update password
                </Button>
              </form>
            </Card>

            <p className="mt-6 text-center text-sm text-ink-muted">
              <Link
                href="/auth/login"
                className="rounded-sm font-medium text-accent hover:text-accent-hover"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
