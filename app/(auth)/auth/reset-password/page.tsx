"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const supabase = createBrowserSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setChecking(false);
    }
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      // Get user and check onboarding status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Ensure profile exists
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
      } else {
        router.push("/sign-in");
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to reset password");
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Invalid reset link</h1>
          <p className="text-sm text-slate-600">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link href="/forgot-password">
            <Button>Request new reset link</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Set new password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              New password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full"
            />
          </div>

          {message && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{message}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>

        <div className="text-center">
          <Link href="/sign-in" className="text-sm text-slate-600 hover:text-slate-900">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

