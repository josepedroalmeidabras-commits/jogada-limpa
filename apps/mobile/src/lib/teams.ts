import { supabase } from './supabase';
import type { ActiveSport } from './profile';

export type Team = {
  id: string;
  name: string;
  photo_url: string | null;
  sport_id: number;
  city: string;
  captain_id: string;
  invite_code: string;
  is_active: boolean;
  created_at: string;
};

export type TeamWithSport = Team & {
  sport: Pick<ActiveSport, 'id' | 'code' | 'name'> | null;
};

export type TeamMember = {
  team_id: string;
  user_id: string;
  role: 'captain' | 'member';
  joined_at: string;
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
         invite_code, is_active, created_at,
         sport:sports!inner(id, code, name)
       )`,
    )
    .eq('user_id', userId);

  if (error) {
    console.error('fetchMyTeams error', error);
    return [];
  }

  // unwrap nested shape
  return (data ?? [])
    .map((row: any) => row.team)
    .filter((t: any): t is TeamWithSport => !!t);
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

  if (error) {
    console.error('fetchTeamMembers error', error);
    return [];
  }
  return (data ?? []) as unknown as TeamMember[];
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
      'id, name, photo_url, sport_id, city, captain_id, invite_code, is_active, created_at',
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
      'id, name, photo_url, sport_id, city, captain_id, invite_code, is_active, created_at',
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
