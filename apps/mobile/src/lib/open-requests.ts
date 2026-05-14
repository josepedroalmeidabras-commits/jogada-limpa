import { supabase } from './supabase';
import { sendPushToUser } from './push';

export type OpenRequest = {
  id: string;
  team_id: string;
  sport_id: number;
  city: string;
  scheduled_at: string;
  location_name: string | null;
  location_tbd: boolean;
  notes: string | null;
  min_elo: number | null;
  max_elo: number | null;
  status: 'open' | 'matched' | 'cancelled';
  match_id: string | null;
  created_by: string;
  created_at: string;
  team?: {
    id: string;
    name: string;
    photo_url: string | null;
    city: string;
  } | null;
  team_win_pct?: number | null;
  team_matches?: number;
};

export async function fetchOpenRequests(city: string): Promise<OpenRequest[]> {
  const { data, error } = await supabase
    .from('open_match_requests')
    .select(
      `id, team_id, sport_id, city, scheduled_at, location_name, location_tbd,
       notes, min_elo, max_elo, status, match_id, created_by, created_at,
       team:teams!open_match_requests_team_id_fkey!inner(id, name, photo_url, city, is_active)`,
    )
    .eq('status', 'open')
    .eq('city', city)
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (error || !data) {
    console.error('fetchOpenRequests error', error);
    return [];
  }

  const filtered = (data as any[]).filter((r) => r.team?.is_active !== false);
  if (filtered.length === 0) return [];

  // join team win stats for badges
  const teamIds = Array.from(new Set(filtered.map((r) => r.team_id)));
  const { data: wins } = await supabase
    .from('team_win_stats')
    .select('team_id, win_pct, matches')
    .in('team_id', teamIds);
  const winMap = new Map(
    (wins ?? []).map((w: any) => [
      w.team_id as string,
      { win_pct: Number(w.win_pct), matches: w.matches as number },
    ]),
  );

  return filtered.map((r) => ({
    ...r,
    team_win_pct: winMap.get(r.team_id)?.win_pct ?? null,
    team_matches: winMap.get(r.team_id)?.matches ?? 0,
  })) as OpenRequest[];
}

export async function fetchMyOpenRequests(): Promise<OpenRequest[]> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from('open_match_requests')
    .select(
      `id, team_id, sport_id, city, scheduled_at, location_name, location_tbd,
       notes, min_elo, max_elo, status, match_id, created_by, created_at,
       team:teams!open_match_requests_team_id_fkey!inner(id, name, photo_url, city)`,
    )
    .eq('status', 'open')
    .eq('created_by', me)
    .order('scheduled_at', { ascending: true });

  if (error || !data) return [];
  return data as unknown as OpenRequest[];
}

export type PostOpenRequestInput = {
  team_id: string;
  scheduled_at: string;
  location_name?: string;
  location_tbd?: boolean;
  notes?: string;
  min_elo?: number;
  max_elo?: number;
};

export async function postOpenRequest(
  input: PostOpenRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('post_open_match_request', {
    p_team_id: input.team_id,
    p_scheduled_at: input.scheduled_at,
    p_location_name: input.location_name ?? null,
    p_location_tbd: input.location_tbd ?? false,
    p_notes: input.notes ?? null,
    p_min_elo: input.min_elo ?? null,
    p_max_elo: input.max_elo ?? null,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível publicar.',
    };
  }
  return { ok: true, id: data as string };
}

export async function acceptOpenRequest(
  requestId: string,
  myTeamId: string,
  posterId?: string,
  myTeamName?: string,
): Promise<{ ok: true; match_id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('accept_open_match_request', {
    p_request_id: requestId,
    p_my_team_id: myTeamId,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível aceitar.',
    };
  }
  const matchId = data as string;
  if (posterId) {
    void sendPushToUser(posterId, {
      title: 'Desafio aceite',
      body: `${myTeamName ?? 'Outra equipa'} aceitou o teu desafio`,
      data: { type: 'open_match_accepted', match_id: matchId },
    });
  }
  return { ok: true, match_id: matchId };
}

export async function cancelOpenRequest(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('cancel_open_match_request', {
    p_request_id: id,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível cancelar.',
    };
  }
  return { ok: true };
}
