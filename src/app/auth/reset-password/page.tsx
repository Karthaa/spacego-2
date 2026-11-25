"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  Building2,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

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
          Choose a New Password
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          {complete ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Password updated
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your password has been changed and you have been signed out.
                Sign in again with your new password.
              </p>
              <Link href="/auth/login" className="block pt-2">
                <Button variant="teal" size="lg" className="w-full font-bold">
                  <span>Continue to sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Verifying your reset link…
            </div>
          ) : !hasSession ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Link invalid or expired
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This password reset link is no longer valid. Request a new link
                and open it in the same browser.
              </p>
              <Link href="/auth/forgot-password" className="block pt-2">
                <Button variant="teal" size="lg" className="w-full font-bold">
                  <span>Request a new link</span>
                  <ArrowRight className="w-4 h-4" />
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
                  label="New Password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText="At least 8 characters."
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                />

                <Button
                  type="submit"
                  variant="teal"
                  size="lg"
                  className="w-full font-bold shadow-md shadow-teal-700/20"
                  isLoading={isSubmitting}
                >
                  <span>Update password</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="pt-2 text-center text-xs text-slate-500">
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
