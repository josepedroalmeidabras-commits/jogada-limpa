import { supabase } from './supabase';

export type SubstituteRequest = {
  id: string;
  match_id: string;
  team_id: string;
  side: 'A' | 'B';
  position_needed: 'gr' | 'def' | 'med' | 'ata' | null;
  count_needed: number;
  count_filled: number;
  notes: string | null;
  city: string;
  status: 'open' | 'filled' | 'cancelled';
  created_by: string;
  created_at: string;
  team?: {
    id: string;
    name: string;
    photo_url: string | null;
  } | null;
  match?: {
    id: string;
    scheduled_at: string;
    location_name: string | null;
    location_tbd: boolean;
    side_a_name?: string;
    side_b_name?: string;
  } | null;
};

export async function fetchOpenSubstituteRequests(
  city: string,
): Promise<SubstituteRequest[]> {
  const { data, error } = await supabase
    .from('open_substitute_requests')
    .select(
      `id, match_id, team_id, side, position_needed, count_needed, count_filled,
       notes, city, status, created_by, created_at,
       team:teams!inner(id, name, photo_url),
       match:matches!inner(id, scheduled_at, location_name, location_tbd, is_internal)`,
    )
    .eq('status', 'open')
    .eq('city', city)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('fetchOpenSubstituteRequests error', error);
    return [];
  }

  const rows = data as any[];
  // exclude requests whose match has already started
  const now = Date.now();
  const fresh = rows.filter(
    (r) => r.match && new Date(r.match.scheduled_at).getTime() > now && !r.match.is_internal,
  );
  return fresh as SubstituteRequest[];
}

export async function postSubstituteRequest(input: {
  match_id: string;
  side: 'A' | 'B';
  position?: string | null;
  count: number;
  notes?: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('post_substitute_request', {
    p_match_id: input.match_id,
    p_side: input.side,
    p_position: input.position ?? null,
    p_count: input.count,
    p_notes: input.notes ?? null,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível publicar.',
    };
  }
  return { ok: true, id: data as string };
}

export async function acceptSubstituteRequest(
  requestId: string,
): Promise<{ ok: true; match_id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('accept_substitute_request', {
    p_request_id: requestId,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível aceitar.',
    };
  }
  return { ok: true, match_id: data as string };
}

export async function cancelSubstituteRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('cancel_substitute_request', {
    p_request_id: requestId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
