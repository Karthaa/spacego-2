"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { homeForRole } from "@/lib/auth/redirects";
import {
  Building2,
  Mail,
  Lock,
  ArrowRight,
  User,
  Phone,
  CheckCircle2,
} from "lucide-react";

type PublicRole = "seeker" | "owner";

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
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-teal-400 shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              Space<span className="text-teal-600">Go</span>
            </span>
          </Link>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Mail className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Check your email
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              We sent a confirmation link to{" "}
              <strong className="text-slate-900">{confirmationEmail}</strong>.
              Open it to activate your account, then sign in.
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              You are not signed in yet. If the message does not arrive, check
              your spam folder or try registering again.
            </p>
            <Link href="/auth/login" className="block pt-2">
              <Button variant="teal" size="lg" className="w-full font-bold">
                <span>Back to sign in</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-teal-400 shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            Space<span className="text-teal-600">Go</span>
          </span>
        </Link>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Create Your SpaceGo Account
        </h2>
        <p className="text-xs text-slate-500">
          Book flexible workspaces or list and activate your properties.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                I want to:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("seeker")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    role === "seeker"
                      ? "border-teal-500 bg-teal-50/70 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-900">
                    Find Workspaces
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Freelancer / Team Seeker
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("owner")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    role === "owner"
                      ? "border-teal-500 bg-teal-50/70 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-900">
                    List or Activate Space
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Property Owner / Host
                  </span>
                </button>
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-medium text-rose-800"
              >
                {formError}
              </div>
            )}

            <Input
              label="Full Name *"
              required
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Work Email *"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password *"
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
              label="Confirm Password *"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phone Number"
                autoComplete="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Input
                label="Company / Studio"
                autoComplete="organization"
                placeholder="Acme Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                leftIcon={<Building2 className="w-4 h-4" />}
              />
            </div>

            <Button
              type="submit"
              variant="teal"
              size="lg"
              className="w-full font-bold shadow-md shadow-teal-700/20"
              isLoading={isSubmitting}
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-bold text-teal-700 hover:text-teal-800"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
