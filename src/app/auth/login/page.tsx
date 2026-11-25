"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { authErrorMessage } from "@/lib/auth/messages";
import { homeForRole, safeNextPath } from "@/lib/auth/redirects";
import {
  Building2,
  Mail,
  Lock,
  ArrowRight,
  AlertTriangle,
  LogOut,
} from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          Loading login…
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
          Sign In to Your Account
        </h2>
        <p className="text-xs text-slate-500">
          Enter your email and password to access your bookings, listings, or
          management console.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          {profileMissing && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900">
                    Your SpaceGo profile is missing
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    You are signed in, but your account has no profile record.
                    Apply the profiles migration or contact support. You can
                    sign out and try another account.
                  </p>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="inline-flex items-center gap-1.5 pt-1 text-[11px] font-bold text-amber-900 hover:text-amber-950"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}

          {(formError || queryError) && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-medium text-rose-800"
            >
              {formError ?? authErrorMessage(queryError)}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
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

            <Input
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <div className="flex items-center justify-end text-xs">
              <Link
                href="/auth/forgot-password"
                className="font-semibold text-teal-700 hover:text-teal-800"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="teal"
              size="lg"
              className="w-full font-bold shadow-md shadow-teal-700/20"
              isLoading={isSubmitting}
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="font-bold text-teal-700 hover:text-teal-800"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
