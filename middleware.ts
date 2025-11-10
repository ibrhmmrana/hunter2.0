import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // At the very top, short-circuit for assets and auth routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/api/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|css|js|txt|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // Build a Supabase server client inside middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage = pathname === '/sign-in' || pathname === '/sign-up';
  const needsAuth = pathname.startsWith('/onboarding') || pathname.startsWith('/dashboard');

  if (!user && needsAuth) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-up';
    return NextResponse.redirect(url);
  }

  // Check if user has completed onboarding from database (once, reuse for all checks)
  // Also ensure profile exists
  let onboardingCompleted = false;
  if (user) {
    try {
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      // If profile doesn't exist, create it (using service role would be better, but middleware can't use it)
      // For now, we'll let the trigger handle it, or it will be created on next auth action
      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[middleware] Error fetching profile:', profileError);
      }

      onboardingCompleted = profile?.onboarding_completed_at !== null;
    } catch (err) {
      // Profile might not exist yet - will be created by trigger or on next auth action
      onboardingCompleted = false;
    }
  }

  if (user && isAuthPage) {
    // Redirect authenticated users away from auth pages
    const url = req.nextUrl.clone();
    url.pathname = onboardingCompleted ? '/dashboard' : '/onboarding/business/search';
    return NextResponse.redirect(url);
  }

  // If user has completed onboarding, protect onboarding routes
  if (onboardingCompleted) {
    // Redirect away from onboarding routes (except business/search which is entry point)
    if (pathname.startsWith('/onboard') || 
        (pathname.startsWith('/onboarding') && 
         !pathname.startsWith('/onboarding/business/search'))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // If user hasn't completed onboarding, protect dashboard and app routes
  if (!onboardingCompleted && user) {
    // Allow access to onboarding routes
    if (pathname.startsWith('/onboarding') || pathname.startsWith('/onboard')) {
      return res;
    }

    // Redirect app routes to onboarding
    if (pathname === '/dashboard' || 
        pathname.startsWith('/scheduler') || 
        pathname.startsWith('/marketplace') || 
        pathname.startsWith('/alerts') || 
        pathname.startsWith('/settings') ||
        pathname.startsWith('/competitors')) {
      // Check if they have a business - if yes, send to analytics, else search
      try {
        const { data: business } = await supabase
          .from('businesses')
          .select('place_id')
          .eq('owner_id', user.id)
          .limit(1)
          .maybeSingle();

        if (business) {
          return NextResponse.redirect(new URL(`/onboard/analytics?place_id=${business.place_id}`, req.url));
        } else {
          return NextResponse.redirect(new URL('/onboarding/business/search', req.url));
        }
      } catch (err) {
        // If we can't check, default to search
        return NextResponse.redirect(new URL('/onboarding/business/search', req.url));
      }
    }
  }

  return res;
}

// Exclude Next.js assets, API routes, and auth callback to avoid 404s on chunks
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api|auth/callback).*)',
  ],
};


