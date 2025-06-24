export const prerender = false;

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return redirect('/?error=missing');
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect('/?error=auth');
  }

  return redirect('/inicio');
};
