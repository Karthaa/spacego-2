"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/messages";
import type { UserProfile, UserRole } from "@/types";

const PROFILE_COLUMNS =
  "id,email,full_name,role,avatar_url,phone,company_name,created_at";
const LEGACY_AUTH_KEY = "spacego_auth_user";

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  role: "seeker" | "owner";
  phone?: string;
  company_name?: string;
}

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
  error: string | null;
}

export type ProfileUpdate = Pick<
  UserProfile,
  "full_name" | "phone" | "company_name" | "avatar_url"
>;

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  hasSession: boolean;
  isLoading: boolean;
  profileError: string | null;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; profile: UserProfile | null }>;
  signUp: (data: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(configured);
  const [profileError, setProfileError] = useState<string | null>(null);

  const getClient = useCallback(() => {
    if (!configured || typeof window === "undefined") return null;
    try {
      return createClient();
    } catch (error) {
      console.error(error);
      return null;
    }
  }, [configured]);

  const fetchProfile = useCallback(
    async (
      userId: string
    ): Promise<{ profile: UserProfile | null; error: string | null }> => {
      const supabase = getClient();
      if (!supabase) {
        return {
          profile: null,
          error:
            "Supabase authentication is not configured for this environment.",
        };
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        return { profile: null, error: authErrorMessage(error.message) };
      }

      if (!data) {
        return {
          profile: null,
          error:
            "Your account is signed in, but no SpaceGo profile was found. Apply the profiles migration or contact support.",
        };
      }

      return { profile: data as UserProfile, error: null };
    },
    [getClient]
  );

  const loadProfile = useCallback(
    async (userId: string) => {
      const { profile, error } = await fetchProfile(userId);
      setUser(profile);
      setProfileError(profile ? null : error);
      return profile;
    },
    [fetchProfile]
  );

  const retryProfile = useCallback(
    async (userId: string) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { profile } = await fetchProfile(userId);
        if (profile) return profile;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return null;
    },
    [fetchProfile]
  );

  // Remove the old fake-auth localStorage entry. Supabase sessions live in
  // cookies managed by @supabase/ssr so the server can verify them.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_AUTH_KEY);
    } catch {
      // Storage can be unavailable in private browsing modes.
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = getClient();
    if (!supabase) {
      // Configuration was validated above, so this is effectively a runtime
      // failure. Resolve the loading state asynchronously rather than setting
      // state synchronously inside the effect.
      const timer = setTimeout(() => setIsLoading(false), 0);
      return () => clearTimeout(timer);
    }

    let active = true;

    const initialize = async () => {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !authUser) {
        setHasSession(false);
        setUser(null);
        setProfileError(null);
        setIsLoading(false);
        return;
      }

      setHasSession(true);
      await loadProfile(authUser.id);
      if (active) setIsLoading(false);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      const authUser = session?.user ?? null;
      setHasSession(Boolean(authUser));

      if (!authUser) {
        setUser(null);
        setProfileError(null);
        setIsLoading(false);
        return;
      }

      // Do not await Supabase calls inside the callback itself; auth-js holds
      // a lock while dispatching events.
      setTimeout(() => {
        if (!active) return;
        void loadProfile(authUser.id).finally(() => {
          if (active) setIsLoading(false);
        });
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured, getClient, loadProfile]);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; profile: UserProfile | null }> => {
    const supabase = getClient();
    if (!supabase) {
      return {
        error:
          "Supabase authentication is not configured for this environment.",
        profile: null,
      };
    }

    if (!email.trim() || !password) {
      return { error: "Enter your email and password.", profile: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: authErrorMessage(error.message), profile: null };
    }

    if (!data.user) {
      return {
        error: "Sign in did not return a user session. Please try again.",
        profile: null,
      };
    }

    setHasSession(true);
    const { profile, error: profileLoadError } = await fetchProfile(data.user.id);

    if (!profile) {
      setUser(null);
      setProfileError(profileLoadError);
      return {
        error: profileLoadError ?? "Unable to load your SpaceGo profile.",
        profile: null,
      };
    }

    setUser(profile);
    setProfileError(null);
    router.refresh();
    return { error: null, profile };
  };

  const signUp = async (input: SignUpInput): Promise<SignUpResult> => {
    const supabase = getClient();
    if (!supabase) {
      return {
        requiresEmailConfirmation: false,
        error:
          "Supabase authentication is not configured for this environment.",
      };
    }

    // Public registration can only ever create a seeker or owner. Admin is
    // never accepted from the client, even if the request is tampered with.
    const role: "seeker" | "owner" =
      input.role === "owner" ? "owner" : "seeker";
    const nextPath = role === "owner" ? "/owner" : "/dashboard";
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: input.full_name.trim(),
          role,
          phone: input.phone?.trim() || null,
          company_name: input.company_name?.trim() || null,
        },
      },
    });

    if (error) {
      return {
        requiresEmailConfirmation: false,
        error: authErrorMessage(error.message),
      };
    }

    // Supabase returns an empty identities array for an existing confirmed
    // user when email enumeration protection is enabled.
    if (data.user?.identities && data.user.identities.length === 0) {
      return {
        requiresEmailConfirmation: false,
        error:
          "An account with this email already exists. Try signing in instead.",
      };
    }

    if (!data.session || !data.user) {
      return { requiresEmailConfirmation: true, error: null };
    }

    setHasSession(true);
    const profile = await retryProfile(data.user.id);

    if (!profile) {
      return {
        requiresEmailConfirmation: false,
        error:
          "Your account was created, but its profile is still being prepared. Please sign in again in a moment.",
      };
    }

    setUser(profile);
    setProfileError(null);
    router.refresh();
    return { requiresEmailConfirmation: false, error: null };
  };

  const signOut = async (): Promise<void> => {
    const supabase = getClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setHasSession(false);
    setProfileError(null);
    router.refresh();
  };

  const updateProfile = async (
    updates: ProfileUpdate
  ): Promise<{ error: string | null }> => {
    const supabase = getClient();
    if (!supabase) {
      return {
        error:
          "Supabase authentication is not configured for this environment.",
      };
    }

    if (!user) {
      return { error: "You must be signed in to update your profile." };
    }

    const fullName = updates.full_name?.trim() ?? user.full_name;
    if (!fullName) {
      return { error: "Full name is required." };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: updates.phone?.trim() || null,
        company_name: updates.company_name?.trim() || null,
        avatar_url: updates.avatar_url ?? user.avatar_url ?? null,
      })
      .eq("id", user.id)
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      return { error: authErrorMessage(error.message) };
    }

    setUser(data as UserProfile);
    return { error: null };
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ error: string | null }> => {
    const supabase = getClient();
    if (!supabase) {
      return {
        error:
          "Supabase authentication is not configured for this environment.",
      };
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    return { error: error ? authErrorMessage(error.message) : null };
  };

  const updatePassword = async (
    password: string
  ): Promise<{ error: string | null }> => {
    const supabase = getClient();
    if (!supabase) {
      return {
        error:
          "Supabase authentication is not configured for this environment.",
      };
    }

    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? authErrorMessage(error.message) : null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? "seeker",
        isAuthenticated: Boolean(user),
        hasSession,
        isLoading,
        profileError,
        signIn,
        signUp,
        signOut,
        updateProfile,
        requestPasswordReset,
        updatePassword,
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
