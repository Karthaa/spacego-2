"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile, UserRole } from "@/types";
import { INITIAL_PROFILES } from "@/lib/data/mockData";

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, role?: UserRole) => Promise<boolean>;
  register: (data: { email: string; full_name: string; role: UserRole; phone?: string; company_name?: string }) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const AUTH_USER_KEY = "spacego_auth_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Default to Alex Vance (Seeker) for instant seamless preview, or load saved user
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      } else {
        // Default initial session: Alex Vance (Seeker)
        const defaultUser = INITIAL_PROFILES[0];
        setUser(defaultUser);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(defaultUser));
      }
    } catch (e) {
      console.error("Auth hydration error:", e);
      setUser(INITIAL_PROFILES[0]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, rolePreference?: UserRole): Promise<boolean> => {
    // Check initial profiles first
    const matchedProfile = INITIAL_PROFILES.find(
      (p) => p.email.toLowerCase() === email.toLowerCase()
    );

    if (matchedProfile) {
      setUser(matchedProfile);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(matchedProfile));
      return true;
    }

    // New or custom email login
    const newProfile: UserProfile = {
      id: `user-${Date.now()}`,
      email,
      full_name: email.split("@")[0].replace(".", " ").replace(/^\w/, (c) => c.toUpperCase()),
      role: rolePreference || "seeker",
      avatar_url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80`,
      created_at: new Date().toISOString(),
    };

    setUser(newProfile);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newProfile));
    return true;
  };

  const register = async (data: {
    email: string;
    full_name: string;
    role: UserRole;
    phone?: string;
    company_name?: string;
  }): Promise<boolean> => {
    // Prevent self-granting of admin on public register form
    const finalRole: UserRole = data.role === "admin" ? "seeker" : data.role;

    const newProfile: UserProfile = {
      id: `user-${Date.now()}`,
      email: data.email,
      full_name: data.full_name,
      role: finalRole,
      phone: data.phone,
      company_name: data.company_name,
      avatar_url:
        finalRole === "owner"
          ? "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80"
          : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
      created_at: new Date().toISOString(),
    };

    setUser(newProfile);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newProfile));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_USER_KEY);
  };

  // Quick switch for reviewing different journeys without tedious credential typing
  const switchRole = (newRole: UserRole) => {
    const targetProfile = INITIAL_PROFILES.find((p) => p.role === newRole) || {
      id: `user-${newRole}`,
      email: `${newRole}@spacego.io`,
      full_name: `${newRole.toUpperCase()} Persona`,
      role: newRole,
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
      created_at: new Date().toISOString(),
    };

    setUser(targetProfile);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(targetProfile));
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || "seeker",
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        switchRole,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
