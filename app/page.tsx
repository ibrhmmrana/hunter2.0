import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPostAuthRoute } from '@/lib/auth/postAuthRouter';

export default async function RootPage() {
  const supabase = createServerSupabaseClient();
  
  // Use unified post-auth router
  const route = await getPostAuthRoute(supabase);
  redirect(route.redirectPath);
}

