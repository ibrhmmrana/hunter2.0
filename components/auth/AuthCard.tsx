"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail } from "lucide-react";

type AuthCardProps = {
  mode: "signup" | "signin";
  title?: string;
  subtitle?: string;
};

export function AuthCard({ mode, title, subtitle }: AuthCardProps) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  // Poll for session if email confirmation is required
  useEffect(() => {
    if (!showSuccess || checkingSession) return;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check onboarding status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Profile should be auto-created by trigger, but check anyway
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed_at")
            .eq("user_id", user.id)
            .maybeSingle();

          // If profile doesn't exist, create it
          if (!profile) {
            await supabase
              .from("profiles")
              .insert({
                user_id: user.id,
                plan: 'free',
              });
          }

          const onboardingCompleted = profile?.onboarding_completed_at !== null;
          // Use hard navigation to ensure middleware picks up the change
          window.location.href = onboardingCompleted ? "/dashboard" : "/onboarding/business/search";
        }
      }
    };

    const interval = setInterval(checkSession, 2000);
    return () => clearInterval(interval);
  }, [showSuccess, checkingSession, supabase, router]);

  const handleOAuth = async (provider: "google" | "azure") => {
    setOauthLoading(provider);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setMessage(error.message || `Failed to sign in with ${provider}`);
      setOauthLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setShowSuccess(false);

    try {
      if (mode === "signup") {
        const origin = window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.user) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // Immediate session, check onboarding and redirect
            // Profile should be auto-created by trigger, but check anyway
            const { data: profile } = await supabase
              .from("profiles")
              .select("onboarding_completed_at")
              .eq("user_id", data.user.id)
              .maybeSingle();

            // If profile doesn't exist, create it
            if (!profile) {
              await supabase
                .from("profiles")
                .insert({
                  user_id: data.user.id,
                  plan: 'free',
                });
            }

            const onboardingCompleted = profile?.onboarding_completed_at !== null;
            // Use hard navigation to ensure middleware picks up the change
            window.location.href = onboardingCompleted ? "/dashboard" : "/onboarding/business/search";
          } else {
            // Email confirmation required
            setShowSuccess(true);
          }
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // Profile should be auto-created by trigger, but check anyway
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed_at")
            .eq("user_id", data.user.id)
            .maybeSingle();

          // If profile doesn't exist, create it
          if (!profile) {
            await supabase
              .from("profiles")
              .insert({
                user_id: data.user.id,
                plan: 'free',
              });
          }

          const onboardingCompleted = profile?.onboarding_completed_at !== null;
          // Use hard navigation to ensure middleware picks up the change
          window.location.href = onboardingCompleted ? "/dashboard" : "/onboarding/business/search";
        }
      }
    } catch (error: any) {
      setMessage(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueCheck = async () => {
    setCheckingSession(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let onboardingCompleted = false;
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed_at")
            .eq("user_id", user.id)
            .maybeSingle();
          onboardingCompleted = profile?.onboarding_completed_at !== null;
        } catch (err) {
          onboardingCompleted = false;
        }
        router.push(
          onboardingCompleted ? "/dashboard" : "/onboarding/business/search"
        );
      }
    } else {
      setCheckingSession(false);
      setMessage(
        "Session not found. Please check your email and click the confirmation link."
      );
    }
  };

  if (showSuccess) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">
            We've sent you a confirmation link to complete your account setup.
          </p>
        </div>
        <div className="space-y-4">
          <Button
            onClick={handleContinueCheck}
            className="w-full"
            variant="outline"
            disabled={checkingSession}
          >
            {checkingSession ? "Checking..." : "Already confirmed? Continue"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            <Link
              href="/sign-in"
              className="text-primary underline hover:text-primary/80"
            >
              Already have an account? Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const displayTitle =
    title || (mode === "signup" ? "Welcome to Hunter" : "Welcome back");
  const displaySubtitle =
    subtitle ||
    (mode === "signup"
      ? "Hunter is a powerful business growth analytics platform. With it, you can track your performance and insights anytime and anywhere."
      : "Sign in to continue to your account and access your business analytics.");

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
      {/* Logo and Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="font-semibold text-lg text-foreground">Hunter</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">{displayTitle}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {displaySubtitle}
        </p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 rounded-2xl border hover:shadow-lg transition-shadow"
          onClick={() => handleOAuth("google")}
          disabled={oauthLoading !== null}
        >
          <svg
            className="w-5 h-5 mr-3"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 rounded-2xl border hover:shadow-lg transition-shadow"
          onClick={() => handleOAuth("azure")}
          disabled={oauthLoading !== null}
        >
          <svg
            className="w-5 h-5 mr-3"
            viewBox="0 0 23 23"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="0" y="0" width="10" height="10" fill="#F25022" />
            <rect x="13" y="0" width="10" height="10" fill="#7FBA00" />
            <rect x="0" y="13" width="10" height="10" fill="#00A4EF" />
            <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
          </svg>
          Continue with Microsoft
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="John.doe@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="pl-10 h-11 rounded-2xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="sr-only">
              Password
            </Label>
            {mode === "signin" && (
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              className="pr-10 h-11 rounded-2xl"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {message && (
          <p className="text-sm text-destructive">{message}</p>
        )}

        <Button
          type="submit"
          className="w-full h-11 rounded-2xl bg-primary hover:bg-primary/90 hover:shadow-lg transition-shadow"
          disabled={loading || oauthLoading !== null}
        >
          {loading
            ? mode === "signup"
              ? "Signing up..."
              : "Signing in..."
            : mode === "signup"
            ? "Continue with email"
            : "Sign in"}
        </Button>
      </form>

      {/* Footer Links */}
      <div className="space-y-4 pt-2">
        <p className="text-xs text-center text-muted-foreground">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="text-primary underline hover:text-primary/80"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <Link
                href="/sign-up"
                className="text-primary underline hover:text-primary/80"
              >
                Create one
              </Link>
            </>
          )}
        </p>

        <p className="text-xs text-center text-muted-foreground leading-relaxed">
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="text-primary underline hover:text-primary/80"
          >
            Terms of service
          </Link>{" "}
          &{" "}
          <Link
            href="/privacy"
            className="text-primary underline hover:text-primary/80"
          >
            Privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

