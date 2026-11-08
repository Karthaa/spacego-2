"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { UserRole } from "@/types";
import { Building2, Mail, Lock, ArrowRight, User, Phone, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { success, error } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState<UserRole>("seeker");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      error("Missing Fields", "Please complete all required fields.");
      return;
    }

    setIsLoading(true);
    try {
      const ok = await register({
        full_name: fullName,
        email,
        role,
        phone,
        company_name: companyName,
      });

      if (ok) {
        success("Account Created!", "Welcome to the SpaceGo platform.");
        if (role === "owner") {
          router.push("/owner");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (e: any) {
      error("Registration Error", e?.message || "Failed to create account.");
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
          Create Your SpaceGo Account
        </h2>
        <p className="text-xs text-slate-500">
          Book flexible workspaces or list and activate your properties.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
          
          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Account Role Selector */}
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
                  <span className="block text-xs font-bold text-slate-900">Find Workspaces</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">Freelancer / Team Seeker</span>
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
                  <span className="block text-xs font-bold text-slate-900">List or Activate Space</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">Property Owner / Host</span>
                </button>
              </div>
            </div>

            <Input
              label="Full Name *"
              required
              placeholder="e.g. Alex Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Work Email *"
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password *"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phone Number"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Input
                label="Company / Studio"
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
              isLoading={isLoading}
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-bold text-teal-700 hover:text-teal-800">
              Sign In
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
