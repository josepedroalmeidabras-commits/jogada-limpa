import { supabase } from './supabase';
import { sendPushToUser } from './push';

export type CreateInternalInput = {
  team_id: string;
  scheduled_at: string;
  location_name?: string;
  location_tbd?: boolean;
  notes?: string;
  side_a_label?: string;
  side_b_label?: string;
  side_a_user_ids: string[];
  side_b_user_ids: string[];
};

export async function createInternalMatch(
  input: CreateInternalInput,
): Promise<{ ok: true; match_id: string } | { ok: false; message: string }> {
  if (input.side_a_user_ids.length === 0 || input.side_b_user_ids.length === 0) {
    return { ok: false, message: 'Os dois lados precisam de jogadores.' };
  }
  const { data, error } = await supabase.rpc('create_internal_match', {
    p_team_id: input.team_id,
    p_scheduled_at: input.scheduled_at,
    p_location_name: input.location_name ?? null,
    p_location_tbd: input.location_tbd ?? false,
    p_notes: input.notes ?? null,
    p_side_a_label: input.side_a_label ?? null,
    p_side_b_label: input.side_b_label ?? null,
    p_side_a_user_ids: input.side_a_user_ids,
    p_side_b_user_ids: input.side_b_user_ids,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível criar a peladinha.',
    };
  }
  return { ok: true, match_id: data as string };
}

export type InternalParticipantInput = {
  user_id: string;
  attended: boolean;
  goals?: number;
  assists?: number;
};

export type AnnounceInput = {
  team_id: string;
  scheduled_at: string;
  location_name?: string;
  location_tbd?: boolean;
  notes?: string;
  side_a_label?: string;
  side_b_label?: string;
};

export async function announceInternalMatch(
  input: AnnounceInput,
): Promise<{ ok: true; match_id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('announce_internal_match', {
    p_team_id: input.team_id,
    p_scheduled_at: input.scheduled_at,
    p_location_name: input.location_name ?? null,
    p_location_tbd: input.location_tbd ?? false,
    p_notes: input.notes ?? null,
    p_side_a_label: input.side_a_label ?? null,
    p_side_b_label: input.side_b_label ?? null,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível anunciar.',
    };
  }
  const matchId = data as string;

  // Fan-out push notifications to every member except the announcer
  void (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    const [{ data: members }, { data: team }] = await Promise.all([
      supabase.from('team_members').select('user_id').eq('team_id', input.team_id),
      supabase.from('teams').select('name').eq('id', input.team_id).maybeSingle(),
    ]);
    if (!members) return;
    const teamName = team?.name ?? 'A tua equipa';
    const when = new Date(input.scheduled_at).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    await Promise.all(
      members
        .filter((m) => m.user_id !== me)
        .map((m) =>
          sendPushToUser(m.user_id, {
            title: `Peladinha · ${teamName}`,
            body: `${when} — vais?`,
            data: {
              type: 'peladinha_invite',
              match_id: matchId,
              team_id: input.team_id,
            },
          }),
        ),
    );
  })();

  return { ok: true, match_id: matchId };
}

export async function assignInternalSides(
  matchId: string,
  sideA: string[],
  sideB: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('assign_internal_sides', {
    p_match_id: matchId,
    p_side_a_user_ids: sideA,
    p_side_b_user_ids: sideB,
  });
  if (error) return { ok: false, message: error.message ?? 'Falhou.' };
  return { ok: true };
}

export type PendingPeladinhaInvite = {
  match_id: string;
  scheduled_at: string;
  location_name: string | null;
  location_tbd: boolean;
  team_id: string;
  team_name: string;
  side_a_label: string | null;
  side_b_label: string | null;
};

export async function fetchPendingPeladinhaInvites(): Promise<
  PendingPeladinhaInvite[]
> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from('match_participants')
    .select(
      `match_id,
       match:matches!inner(id, scheduled_at, location_name, location_tbd, status, is_internal, side_a_label, side_b_label),
       sides:match_sides!inner(team_id, team:teams!inner(id, name))`,
    )
    .eq('user_id', me)
    .eq('invitation_status', 'pending');
  if (error || !data) return [];

  const now = Date.now();
  return (data as any[])
    .filter((r) => r.match?.is_internal === true)
    .filter((r) => r.match?.status === 'confirmed')
    .filter((r) => new Date(r.match.scheduled_at).getTime() > now)
    .map((r): PendingPeladinhaInvite => {
      const side = Array.isArray(r.sides) ? r.sides[0] : r.sides;
      return {
        match_id: r.match.id,
        scheduled_at: r.match.scheduled_at,
        location_name: r.match.location_name,
        location_tbd: r.match.location_tbd,
        team_id: side?.team_id ?? '',
        team_name: side?.team?.name ?? '',
        side_a_label: r.match.side_a_label ?? null,
        side_b_label: r.match.side_b_label ?? null,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime(),
    );
}

export async function respondToMatchInvite(
  matchId: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return { ok: false, message: 'Sem sessão.' };
  const { error } = await supabase
    .from('match_participants')
    .update({
      invitation_status: accept ? 'accepted' : 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('match_id', matchId)
    .eq('user_id', me);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function submitInternalMatchResult(input: {
  match_id: string;
  score_a: number;
  score_b: number;
  participants: InternalParticipantInput[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('submit_internal_match_result', {
    p_match_id: input.match_id,
    p_score_a: input.score_a,
    p_score_b: input.score_b,
    p_participants: input.participants.map((p) => ({
      user_id: p.user_id,
      attended: p.attended,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
    })),
  });
  if (error) {
    return { ok: false, message: error.message ?? 'Falhou submeter.' };
  }
  return { ok: true };
}
