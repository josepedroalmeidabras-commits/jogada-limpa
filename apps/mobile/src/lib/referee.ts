import { supabase } from './supabase';

export type RefereeProfile = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
};

export async function fetchReferee(
  userId: string,
): Promise<RefereeProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, photo_url, city')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RefereeProfile;
}

export async function setMatchReferee(
  matchId: string,
  refereeId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('set_match_referee', {
    p_match_id: matchId,
    p_referee_id: refereeId,
  });
  if (error) {
    return { ok: false, message: error.message ?? 'Falhou.' };
  }
  return { ok: true };
}

export type RefereeReviewInput = {
  match_id: string;
  fair_play: number;
  punctuality: number;
  technical_level: number;
  attitude: number;
  comment?: string;
};

export async function submitRefereeReview(
  input: RefereeReviewInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('submit_referee_review', {
    p_match_id: input.match_id,
    p_fair_play: input.fair_play,
    p_punctuality: input.punctuality,
    p_technical_level: input.technical_level,
    p_attitude: input.attitude,
    p_comment: input.comment ?? null,
  });
  if (error) {
    return { ok: false, message: error.message ?? 'Falhou.' };
  }
  return { ok: true };
}

export async function hasReviewedReferee(
  matchId: string,
  refereeId: string,
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return false;
  const { count, error } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('reviewer_id', me)
    .eq('reviewed_id', refereeId)
    .eq('role', 'referee');
  if (error) return false;
  return (count ?? 0) > 0;
}
