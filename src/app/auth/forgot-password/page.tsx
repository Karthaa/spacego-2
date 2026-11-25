"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/navigation/Navbar";
import { Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const { error: toastError } = useToast();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("Enter the email address for your account.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email);

      if (result.error) {
        setFormError(result.error);
        toastError("Reset Request Failed", result.error);
        return;
      }

      // Always show the same confirmation so the form cannot be used to
      // discover which email addresses have accounts.
      setSent(true);
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

        {sent ? (
          <Card elevation="raised" padding="lg" className="mt-8 text-center">
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent-soft-ink"
            >
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
              Check your email
            </h1>
            <p className="mt-2 text-base text-ink-muted">
              If an account exists for{" "}
              <strong className="font-semibold text-ink">{email.trim()}</strong>,
              a password reset link is on its way. Open it to choose a new
              password.
            </p>
            <p className="mt-3 text-sm text-ink-subtle">
              The link expires after a short time. If it does not arrive, check
              your spam folder and try again.
            </p>
            <Link
              href="/auth/login"
              className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}
            >
              Back to sign in
            </Link>
          </Card>
        ) : (
          <>
            <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-ink">
              Reset your password
            </h1>
            <p className="mt-2 text-center text-base text-ink-muted">
              Enter your account email and we&apos;ll send you a reset link.
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
                  label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail aria-hidden="true" />}
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  isLoading={isSubmitting}
                >
                  Send reset link
                </Button>
              </form>
            </Card>

            <p className="mt-6 text-center text-sm text-ink-muted">
              Remembered it?{" "}
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
