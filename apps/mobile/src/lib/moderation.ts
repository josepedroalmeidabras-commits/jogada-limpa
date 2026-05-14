import { supabase } from './supabase';

export type BlockedUser = {
  blocked_id: string;
  reason: string | null;
  created_at: string;
  profile: {
    id: string;
    name: string;
    photo_url: string | null;
    city: string;
  } | null;
};

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select(
      `blocked_id, reason, created_at,
       profile:profiles!blocked_users_blocked_id_fkey(id, name, photo_url, city)`,
    )
    .order('created_at', { ascending: false });
  if (error || !data) {
    console.error('fetchBlockedUsers error', error);
    return [];
  }
  return data as unknown as BlockedUser[];
}

export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error || !data) return new Set();
  const ids = new Set<string>();
  for (const r of data as Array<{ blocked_id: string; blocker_id: string }>) {
    ids.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
  }
  return ids;
}

export async function blockUser(
  blockedId: string,
  reason?: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocked_id: blockedId, reason: reason ?? null });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function unblockUser(
  blockedId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return { ok: false, message: 'Sem sessão.' };
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', blockedId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type ReportReason =
  | 'comportamento_violento'
  | 'insultos'
  | 'no_show_repetido'
  | 'perfil_falso'
  | 'spam'
  | 'outro';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  comportamento_violento: 'Comportamento violento',
  insultos: 'Insultos / linguagem ofensiva',
  no_show_repetido: 'Faltas repetidas a jogos',
  perfil_falso: 'Perfil falso',
  spam: 'Spam / mensagens indesejadas',
  outro: 'Outro',
};

export async function reportUser(args: {
  reportedId: string;
  reason: ReportReason;
  details?: string;
  matchId?: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (args.matchId) {
    const { error } = await supabase.rpc('report_player_in_match', {
      p_match_id: args.matchId,
      p_reported_id: args.reportedId,
      p_reason: args.reason,
      p_details: args.details ?? null,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }
  const { error } = await supabase.from('user_reports').insert({
    reported_id: args.reportedId,
    reason: args.reason,
    details: args.details ?? null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type ModerationFlags = {
  isSuspended: boolean;
  suspendedAt: string | null;
  warningPending: boolean;
  reportedMatchCount: number;
};

export async function fetchModerationFlags(
  userId: string,
): Promise<ModerationFlags | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'is_suspended, suspended_at, warning_pending, reported_match_count',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    is_suspended: boolean | null;
    suspended_at: string | null;
    warning_pending: boolean | null;
    reported_match_count: number | null;
  };
  return {
    isSuspended: !!row.is_suspended,
    suspendedAt: row.suspended_at,
    warningPending: !!row.warning_pending,
    reportedMatchCount: row.reported_match_count ?? 0,
  };
}

export async function acknowledgeWarning(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const { error } = await supabase.rpc('acknowledge_warning');
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
