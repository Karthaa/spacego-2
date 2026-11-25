"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Building2, Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

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
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-[#0B132B] flex items-center justify-center text-teal-400 shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            Space<span className="text-teal-600">Go</span>
          </span>
        </Link>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Reset Your Password
        </h2>
        <p className="text-xs text-slate-500">
          Enter your account email and we&apos;ll send a secure reset link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Check your email
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                If an account exists for{" "}
                <strong className="text-slate-900">{email.trim()}</strong>, a
                password reset link is on its way. Open it to choose a new
                password.
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The link expires after a short time. If it does not arrive,
                check your spam folder and try again.
              </p>
              <Link href="/auth/login" className="block pt-2">
                <Button variant="teal" size="lg" className="w-full font-bold">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to sign in</span>
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {formError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-medium text-rose-800"
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                  label="Email Address"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Button
                  type="submit"
                  variant="teal"
                  size="lg"
                  className="w-full font-bold shadow-md shadow-teal-700/20"
                  isLoading={isSubmitting}
                >
                  <span>Send reset link</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="pt-2 text-center text-xs text-slate-500">
                Remembered it?{" "}
                <Link
                  href="/auth/login"
                  className="font-bold text-teal-700 hover:text-teal-800"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
