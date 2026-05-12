import { supabase } from './supabase';

export type MatchParticipant = {
  match_id: string;
  user_id: string;
  side: 'A' | 'B';
  invitation_status: 'pending' | 'accepted' | 'declined';
  attendance: 'attended' | 'missed' | 'substitute_in' | 'substitute_out' | null;
  profile: { id: string; name: string; photo_url: string | null } | null;
};

export async function fetchMatchParticipants(
  matchId: string,
): Promise<MatchParticipant[]> {
  const { data, error } = await supabase
    .from('match_participants')
    .select(
      `match_id, user_id, side, invitation_status, attendance,
       profile:profiles!inner(id, name, photo_url)`,
    )
    .eq('match_id', matchId);

  if (error || !data) {
    console.error('fetchMatchParticipants error', error);
    return [];
  }
  return data as unknown as MatchParticipant[];
}

export async function submitMatchSideResult(input: {
  match_id: string;
  score_a: number;
  score_b: number;
  attended_user_ids: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('submit_match_side_result', {
    p_match_id: input.match_id,
    p_score_a: input.score_a,
    p_score_b: input.score_b,
    p_attended_user_ids: input.attended_user_ids,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível submeter o resultado.',
    };
  }
  return { ok: true };
}
