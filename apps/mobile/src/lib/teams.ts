import { supabase } from './supabase';
import type { ActiveSport } from './profile';

export const POSITION_SHORT: Record<string, string> = {
  gr: 'GR',
  def: 'DEF',
  med: 'MED',
  ata: 'ATA',
};

export const POSITION_LABEL: Record<string, string> = {
  gr: 'Guarda-redes',
  def: 'Defesa',
  med: 'Médio',
  ata: 'Avançado',
};

export function positionShort(p: string | null | undefined): string | null {
  if (!p) return null;
  return POSITION_SHORT[p] ?? p.toUpperCase();
}

export type Team = {
  id: string;
  name: string;
  photo_url: string | null;
  sport_id: number;
  city: string;
  captain_id: string;
  invite_code: string;
  is_active: boolean;
  description: string | null;
  coach_id: string | null;
  created_at: string;
};

export async function setTeamCoach(
  teamId: string,
  coachId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('set_team_coach', {
    p_team_id: teamId,
    p_coach_id: coachId,
  });
  if (error) return { ok: false, message: error.message ?? 'Falhou.' };
  return { ok: true };
}

export type CoachProfile = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
};

export async function fetchCoach(
  coachId: string,
): Promise<CoachProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, photo_url, city')
    .eq('id', coachId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CoachProfile;
}

export type TeamWithSport = Team & {
  sport: Pick<ActiveSport, 'id' | 'code' | 'name'> | null;
};

export type TeamMember = {
  team_id: string;
  user_id: string;
  role: 'captain' | 'member';
  joined_at: string;
  preferred_position: string | null;
  elo: number | null;
  profile: { id: string; name: string; photo_url: string | null } | null;
};

export async function fetchMyTeams(
  userId: string,
): Promise<TeamWithSport[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(
      `team:teams!inner(
         id, name, photo_url, sport_id, city, captain_id,
         invite_code, is_active, description, coach_id, created_at,
         sport:sports!inner(id, code, name)
       )`,
    )
    .eq('user_id', userId);

  if (error) {
    console.error('fetchMyTeams error', error);
    return [];
  }

  // unwrap nested shape, hide deactivated teams
  return (data ?? [])
    .map((row: any) => row.team)
    .filter((t: any): t is TeamWithSport => !!t && t.is_active !== false);
}

export async function fetchTeamById(
  teamId: string,
): Promise<TeamWithSport | null> {
  const { data, error } = await supabase
    .from('teams')
    .select(
      `id, name, photo_url, sport_id, city, captain_id,
       invite_code, is_active, created_at,
       sport:sports!inner(id, code, name)`,
    )
    .eq('id', teamId)
    .maybeSingle();

  if (error) {
    console.error('fetchTeamById error', error);
    return null;
  }
  return data as TeamWithSport | null;
}

export async function fetchTeamMembers(
  teamId: string,
): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(
      `team_id, user_id, role, joined_at,
       profile:profiles!inner(id, name, photo_url)`,
    )
    .eq('team_id', teamId);

  if (error || !data) {
    console.error('fetchTeamMembers error', error);
    return [];
  }

  // Hydrate F7 position + ELO from user_sports
  const userIds = data.map((m: any) => m.user_id);
  let posMap = new Map<string, { position: string | null; elo: number | null }>();
  if (userIds.length > 0) {
    const { data: sports } = await supabase
      .from('user_sports')
      .select('user_id, preferred_position, elo')
      .in('user_id', userIds)
      .eq('sport_id', 2);
    posMap = new Map(
      (sports ?? []).map((s: any) => [
        s.user_id as string,
        {
          position: s.preferred_position ?? null,
          elo: s.elo !== null && s.elo !== undefined ? Number(s.elo) : null,
        },
      ]),
    );
  }

  return data.map((m: any) => ({
    team_id: m.team_id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    preferred_position: posMap.get(m.user_id)?.position ?? null,
    elo: posMap.get(m.user_id)?.elo ?? null,
    profile: m.profile ?? null,
  })) as TeamMember[];
}

export type CreateTeamInput = {
  name: string;
  sport_id: number;
  city: string;
};

export async function createTeam(
  captainId: string,
  input: CreateTeamInput,
): Promise<{ ok: true; team: Team } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('teams')
    .insert({
      name: input.name,
      sport_id: input.sport_id,
      city: input.city,
      captain_id: captainId,
    })
    .select(
      'id, name, photo_url, sport_id, city, captain_id, invite_code, is_active, description, coach_id, created_at',
    )
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível criar a equipa.',
    };
  }
  // trg_team_created inserts the captain in team_members automatically
  return { ok: true, team: data };
}

export async function transferCaptaincy(
  teamId: string,
  newCaptainId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // 1. Promote new member to captain role
  const { error: roleErr } = await supabase
    .from('team_members')
    .update({ role: 'captain' })
    .eq('team_id', teamId)
    .eq('user_id', newCaptainId);
  if (roleErr) {
    return {
      ok: false,
      message: roleErr.message ?? 'Não foi possível promover.',
    };
  }
  // 2. Update teams.captain_id (only the current captain has UPDATE rights)
  const { error: teamErr } = await supabase
    .from('teams')
    .update({ captain_id: newCaptainId })
    .eq('id', teamId);
  if (teamErr) {
    return {
      ok: false,
      message: teamErr.message ?? 'Não foi possível transferir capitania.',
    };
  }
  // 3. Demote old captain to member — find by selecting all team_members
  //    with role=captain except the new one.
  const { error: demoteErr } = await supabase
    .from('team_members')
    .update({ role: 'member' })
    .eq('team_id', teamId)
    .neq('user_id', newCaptainId)
    .eq('role', 'captain');
  if (demoteErr) {
    console.warn('demote old captain failed', demoteErr);
  }
  return { ok: true };
}

export async function deactivateTeam(
  teamId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('teams')
    .update({ is_active: false })
    .eq('id', teamId);
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível eliminar.',
    };
  }
  return { ok: true };
}

export async function updateTeam(
  teamId: string,
  input: { name?: string; city?: string; description?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.description !== undefined) patch.description = input.description;
  const { error } = await supabase
    .from('teams')
    .update(patch)
    .eq('id', teamId);
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível atualizar a equipa.',
    };
  }
  return { ok: true };
}

export async function leaveTeam(
  teamId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível sair.',
    };
  }
  return { ok: true };
}

export async function joinTeamByCode(
  userId: string,
  inviteCode: string,
): Promise<{ ok: true; team: Team } | { ok: false; message: string }> {
  const code = inviteCode.trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(code)) {
    return { ok: false, message: 'Código inválido.' };
  }

  const { data: team, error: findError } = await supabase
    .from('teams')
    .select(
      'id, name, photo_url, sport_id, city, captain_id, invite_code, is_active, description, coach_id, created_at',
    )
    .eq('invite_code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (findError || !team) {
    return { ok: false, message: 'Equipa não encontrada com esse código.' };
  }

  const { error: joinError } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'member' });

  if (joinError) {
    if (joinError.code === '23505') {
      return { ok: true, team };
    }
    return {
      ok: false,
      message: joinError.message ?? 'Não foi possível entrar na equipa.',
    };
  }
  return { ok: true, team };
}
