import { supabase } from './supabase';

export const ADMIN_EMAIL = 'josepedroalmeidabras@gmail.com';

export type WaitlistEntry = {
  id: string;
  email: string;
  city: string | null;
  source: string | null;
  created_at: string;
};

export async function fetchWaitlist(): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase.rpc('get_waitlist');
  if (error || !data) {
    console.error('fetchWaitlist error', error);
    return [];
  }
  return data as WaitlistEntry[];
}
