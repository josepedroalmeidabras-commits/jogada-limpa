import { supabase } from './supabase';

export type InFormReason = 'scorer' | 'mvp' | 'both';

export type InFormStatus = {
  reason: InFormReason;
  gaCount: number;
  goals: number;
  assists: number;
  mvpCount: number;
};

export async function fetchInFormStatus(
  userId: string,
): Promise<InFormStatus | null> {
  const { data, error } = await supabase
    .from('user_in_form')
    .select('reason, ga_count, goals, assists, mvp_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || !data.reason) return null;
  return {
    reason: data.reason as InFormReason,
    gaCount: data.ga_count as number,
    goals: data.goals as number,
    assists: data.assists as number,
    mvpCount: data.mvp_count as number,
  };
}
