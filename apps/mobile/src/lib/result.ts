import { supabase } from './supabase';
import { sendPushToUser } from './push';

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

export type OpenSubstitute = {
  user_id: string;
  name: string;
  city: string;
  elo: number;
  matches_played: number;
  open_until: string | null;
};

export async function fetchOpenSubstitutes(
  sportId: number,
  excludeUserIds: string[],
): Promise<OpenSubstitute[]> {
  const { data, error } = await supabase
    .from('user_sports')
    .select(
      `user_id, elo, matches_played, open_until,
       profile:profiles!inner(id, name, city)`,
    )
    .eq('sport_id', sportId)
    .eq('is_open_to_sub', true)
    .gt('open_until', new Date().toISOString());
  if (error || !data) {
    console.error('fetchOpenSubstitutes error', error);
    return [];
  }
  const excluded = new Set(excludeUserIds);
  return (data as any[])
    .filter((r) => !excluded.has(r.user_id))
    .map(
      (r): OpenSubstitute => ({
        user_id: r.user_id,
        name: r.profile?.name ?? 'Jogador',
        city: r.profile?.city ?? '',
        elo: Number(r.elo),
        matches_played: r.matches_played,
        open_until: r.open_until,
      }),
    )
    .sort((a, b) => b.elo - a.elo);
}

export async function inviteSubstitute(input: {
  match_id: string;
  user_id: string;
  side: 'A' | 'B';
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('match_participants').insert({
    match_id: input.match_id,
    user_id: input.user_id,
    side: input.side,
    invitation_status: 'accepted',
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'Este jogador já está no jogo.' };
    }
    return {
      ok: false,
      message: error.message ?? 'Não foi possível convidar.',
    };
  }

  void sendPushToUser(input.user_id, {
    title: 'Convite para um jogo',
    body: 'Um capitão adicionou-te a um jogo como substituto.',
    data: { match_id: input.match_id, type: 'substitute_invited' },
  });

  return { ok: true };
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

  // Notify the other captain to confirm
  void (async () => {
    const { data: sides } = await supabase
      .from('match_sides')
      .select('side, captain_id')
      .eq('match_id', input.match_id);
    if (!sides) return;
    const me = (await supabase.auth.getUser()).data.user?.id;
    const other = sides.find((s) => s.captain_id !== me);
    if (other?.captain_id) {
      await sendPushToUser(other.captain_id, {
        title: 'Resultado submetido',
        body: 'O outro capitão submeteu o resultado. Confirma o teu para validar.',
        data: { match_id: input.match_id, type: 'result_submitted' },
      });
    }
  })();

  return { ok: true };
}
