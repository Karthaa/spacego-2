"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { UserRole } from "@/types";
import { Building2, Mail, Lock, ArrowRight, ShieldCheck, Sparkles, User } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading login...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { success, error } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const redirectUrl = searchParams.get("redirect");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      error("Missing Email", "Please enter your email address.");
      return;
    }

    setIsLoading(true);
    try {
      const ok = await login(email);
      if (ok) {
        success("Signed in successfully", `Welcome back!`);
        if (redirectUrl) {
          router.push(redirectUrl);
        } else if (email.includes("admin")) {
          router.push("/admin");
        } else if (email.includes("owner")) {
          router.push("/owner");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (e: any) {
      error("Sign In Failed", e?.message || "Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, targetPath: string) => {
    setIsLoading(true);
    try {
      await login(demoEmail);
      success("Logged in as Demo Persona", demoEmail);
      router.push(targetPath);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      
      {/* Brand Header */}
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
          Enter your email to access your bookings, listings, or management console.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                <span>Remember me</span>
              </label>
              <Link href="#" className="font-semibold text-teal-700 hover:text-teal-800">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="teal"
              size="lg"
              className="w-full font-bold shadow-md shadow-teal-700/20"
              isLoading={isLoading}
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Quick Demo Logins Section */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                1-Click Demo Evaluation Accounts
              </span>
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("alex.seeker@spacego.io", "/dashboard")}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 text-left transition-all text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Space Seeker (Customer)</span>
                  <span className="text-[10px] text-slate-500">alex.seeker@spacego.io</span>
                </div>
                <span className="text-teal-700 font-semibold text-xs">Login →</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin("elena.owner@spacego.io", "/owner")}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 text-left transition-all text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Property Owner (Host)</span>
                  <span className="text-[10px] text-slate-500">elena.owner@spacego.io</span>
                </div>
                <span className="text-teal-700 font-semibold text-xs">Login →</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin("admin@spacego.io", "/admin")}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 text-left transition-all text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Administrator (Ops & Demand)</span>
                  <span className="text-[10px] text-slate-500">admin@spacego.io</span>
                </div>
                <span className="text-teal-700 font-semibold text-xs">Login →</span>
              </button>
            </div>
          </div>

          <div className="pt-2 text-center text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="font-bold text-teal-700 hover:text-teal-800">
              Create an account
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
