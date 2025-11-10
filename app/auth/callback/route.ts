import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPostAuthRoute } from '@/lib/auth/postAuthRouter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const finish = (pathname: string) =>
    NextResponse.redirect(new URL(pathname, url.origin));

  if (error) {
    // Bubble the provider error back to UI
    return finish(`/sign-up?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    // Some providers return hash fragments; if we ever land here without code, send user back.
    return finish('/sign-up?error=missing_code');
  }

  const supabase = createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('exchangeCodeForSession error', exchangeError);
    return finish(`/sign-up?error=${encodeURIComponent(exchangeError.message)}`);
  }

  // Use unified post-auth router
  const route = await getPostAuthRoute(supabase);
  return finish(route.redirectPath);
}

