'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabaseBrowser, createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Mail, Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  
  // Initialize Supabase client - only on client side
  const [supabase, setSupabase] = useState<any>(null);
  
  useEffect(() => {
    // Only initialize on client side
    if (typeof window === 'undefined') return;
    
    try {
      const client = supabaseBrowser();
      setSupabase(client);
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
    }
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleOAuth = async () => {
    if (typeof window === 'undefined') return;
    setOauthLoading(true);
    setMessage("");

    try {
      const supabase = createBrowserSupabaseClient();
      const origin = window.location.origin;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'consent' }
        },
      });
      if (error) {
        console.error('oauth start error', error);
        window.location.href = `/sign-in?error=${encodeURIComponent(error.message)}`;
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      console.error('oauth error', error);
      setMessage(error.message || "Failed to sign in with Google");
      setOauthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || typeof window === 'undefined') return;
    setLoading(true);
    setMessage("");

    try {
      if (!password || password.length < 6) {
        setMessage("Password must be at least 6 characters");
        setLoading(false);
        return;
      }

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
    } catch (error: any) {
      setMessage(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white grid grid-cols-1 lg:grid-cols-2">
      {/* Left panel - Full height image */}
      <div className="h-screen w-full p-2 lg:p-3 hidden lg:block">
        <div className="relative h-full w-full rounded-[32px] overflow-hidden">
          <Image
            src="https://pcfvqdusjtpoyopresqc.supabase.co/storage/v1/object/public/Storage/login-background-DLa1CaU3.jpg"
            alt="Welcome"
            fill
            className="object-cover"
            priority
            sizes="50vw"
          />
        </div>
      </div>

      {/* Mobile image - shown only on small screens */}
      <div className="w-full h-[300px] p-2 lg:hidden">
        <div className="relative h-full w-full rounded-[32px] overflow-hidden">
          <Image
            src="https://pcfvqdusjtpoyopresqc.supabase.co/storage/v1/object/public/Storage/login-background-DLa1CaU3.jpg"
            alt="Welcome"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="w-full flex items-center py-10 lg:py-0">
        <div className="mx-auto w-full max-w-[520px] px-6 lg:px-10">
          {/* Brand row */}
          <div className="mb-6 flex justify-center">
            <div className="relative w-32 h-12">
              <Image
                src="https://pcfvqdusjtpoyopresqc.supabase.co/storage/v1/object/public/Storage/Hunter%20From%20Sagentics%20Logo.png"
                alt="Hunter Logo"
                fill
                className="object-contain"
                priority
                sizes="128px"
              />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-3 mb-7 text-center">
            <h1 className="text-5xl lg:text-[44px] font-semibold tracking-tight text-gray-900 leading-tight">
              Welcome back
            </h1>
            <p className="mt-3 text-[16px] leading-7 text-gray-500 max-w-[48ch] mx-auto">
              Sign in to continue to your account and access your business analytics.
            </p>
          </div>

          {/* Social buttons */}
          <div className="space-y-3 mb-6">
            {/* Google button */}
            <button
              type="button"
              onClick={handleOAuth}
              disabled={oauthLoading || loading}
              className="h-14 w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-3 text-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-5 h-5"
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
            </button>

          </div>

          {/* Divider */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 my-6">
            <hr className="border-gray-200" />
            <span className="text-sm text-gray-500">Or</span>
            <hr className="border-gray-200" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-14 w-full rounded-xl border border-gray-300 pl-12 pr-4 text-[15px] placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-0"
              />
            </div>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                className="h-14 w-full rounded-xl border border-gray-300 pl-4 pr-12 text-[15px] placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {message && (
              <p className="text-sm text-red-600">{message}</p>
            )}

            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="h-14 w-full rounded-xl bg-[#153E23] hover:bg-[#1a4d2a] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Sign up link */}
          <p className="text-sm text-gray-900 mb-8 text-center">
            Don't have an account?{" "}
            <Link
              href="/sign-up"
              className="hover:underline"
            >
              Sign up
            </Link>
          </p>

          {/* Legal text */}
          <p className="text-xs text-center text-gray-500">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="font-bold underline">
              Terms of service
            </Link>{" "}
            &{" "}
            <Link href="/privacy" className="font-bold underline">
              Privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
