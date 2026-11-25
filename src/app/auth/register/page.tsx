"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/navigation/Navbar";
import { homeForRole } from "@/lib/auth/redirects";
import { cn } from "@/lib/utils";
import { Mail, Lock, User, Phone, Building2 } from "lucide-react";

type PublicRole = "seeker" | "owner";

const ROLE_OPTIONS: { value: PublicRole; title: string; description: string }[] = [
  {
    value: "seeker",
    title: "Book workspace",
    description: "Find and book desks, offices and rooms.",
  },
  {
    value: "owner",
    title: "Host a space",
    description: "List a space or submit one for review.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { success, error: toastError } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState<PublicRole>("seeker");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setFormError("Please complete your name, email, and password.");
      return;
    }

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
      const result = await signUp({
        full_name: fullName,
        email,
        password,
        role,
        phone,
        company_name: companyName,
      });

      if (result.error) {
        setFormError(result.error);
        toastError("Registration Error", result.error);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setConfirmationEmail(email.trim());
        return;
      }

      success("Account Created!", "Welcome to the SpaceGo platform.");
      router.replace(homeForRole(role));
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmationEmail) {
    return (
      <main id="main" className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center">
            <Logo />
          </div>

          <Card elevation="raised" padding="lg" className="mt-8 text-center">
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent-soft-ink"
            >
              <Mail className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
              Check your email
            </h1>
            <p className="mt-2 text-base text-ink-muted">
              We sent a confirmation link to{" "}
              <strong className="font-semibold text-ink">{confirmationEmail}</strong>.
              Open it to activate your account, then sign in.
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              You are not signed in yet. If the message does not arrive, check
              your spam folder or try registering again.
            </p>
            <Link
              href="/auth/login"
              className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}
            >
              Back to sign in
            </Link>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-ink">
          Create your account
        </h1>
        <p className="mt-2 text-center text-base text-ink-muted">
          Book flexible workspace, or host your own space.
        </p>

        <Card elevation="raised" padding="lg" className="mt-8">
          <form onSubmit={handleRegister} className="space-y-5" noValidate>
            <fieldset>
              <legend className="text-sm font-medium text-ink">
                How will you use SpaceGo?
              </legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ROLE_OPTIONS.map((option) => {
                  const selected = role === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex min-h-11 cursor-pointer flex-col rounded-md border p-3 transition-colors",
                        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                        selected
                          ? "border-accent bg-accent-soft"
                          : "border-line-strong bg-surface hover:bg-surface-muted"
                      )}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={selected}
                        onChange={() => setRole(option.value)}
                        className="sr-only"
                      />
                      <span className="text-sm font-semibold text-ink">
                        {option.title}
                      </span>
                      <span className="mt-0.5 text-sm text-ink-muted">
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {formError && (
              <div
                role="alert"
                className="rounded-md bg-danger-soft p-3 text-sm font-medium text-danger"
              >
                {formError}
              </div>
            )}

            <Input
              label="Full name"
              required
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User aria-hidden="true" />}
            />

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

            <Input
              label="Password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="At least 8 characters."
              leftIcon={<Lock aria-hidden="true" />}
            />

            <Input
              label="Confirm password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock aria-hidden="true" />}
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3">
              <Input
                label="Phone (optional)"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone aria-hidden="true" />}
              />
              <Input
                label="Company (optional)"
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                leftIcon={<Building2 aria-hidden="true" />}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
            >
              Create account
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="rounded-sm font-medium text-accent hover:text-accent-hover"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
