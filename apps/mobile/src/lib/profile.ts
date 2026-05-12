import { supabase } from './supabase';

export type Foot = 'left' | 'right' | 'both';

export const FOOT_LABEL: Record<Foot, string> = {
  left: 'Pé esquerdo',
  right: 'Pé direito',
  both: 'Ambidextro',
};

export function formatDisplayName(p: {
  name: string;
  nickname?: string | null;
}): string {
  if (p.nickname && p.nickname.trim().length > 0) {
    const parts = p.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} «${p.nickname}» ${parts.slice(1).join(' ')}`;
    }
    return `${p.name} «${p.nickname}»`;
  }
  return p.name;
}

export type Profile = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
  birthdate: string;
  phone: string | null;
  bio: string | null;
  jersey_number: number | null;
  nickname: string | null;
  preferred_foot: Foot | null;
  deleted_at: string | null;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, name, photo_url, city, birthdate, phone, bio, jersey_number, nickname, preferred_foot, deleted_at',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('fetchProfile error', error);
    return null;
  }
  return data;
}

export async function deleteMyAccount(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível eliminar a conta.',
    };
  }
  return { ok: true };
}

export type ActiveSport = {
  id: number;
  code: string;
  name: string;
  format: 'team' | 'doubles';
};

export async function fetchActiveSports(): Promise<ActiveSport[]> {
  const { data, error } = await supabase
    .from('sports')
    .select('id, code, name, format')
    .eq('is_active', true)
    .order('id');

  if (error) {
    console.error('fetchActiveSports error', error);
    return [];
  }
  return (data ?? []) as ActiveSport[];
}

export type ProfileSubmission = {
  name: string;
  birthdate: string; // ISO YYYY-MM-DD
  city: string;
  sports: { sport_id: number; declared_level: number }[];
};

export type ProfileUpdate = {
  name?: string;
  city?: string;
  phone?: string | null;
  bio?: string | null;
  jersey_number?: number | null;
  nickname?: string | null;
  preferred_foot?: Foot | null;
};

export async function updateProfile(
  userId: string,
  input: ProfileUpdate,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.jersey_number !== undefined) patch.jersey_number = input.jersey_number;
  if (input.nickname !== undefined) patch.nickname = input.nickname;
  if (input.preferred_foot !== undefined) patch.preferred_foot = input.preferred_foot;
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível guardar.',
    };
  }
  return { ok: true };
}

export async function createProfile(
  userId: string,
  input: ProfileSubmission,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    name: input.name,
    birthdate: input.birthdate,
    city: input.city,
  });
  if (profileError) {
    return {
      ok: false,
      message: profileError.message ?? 'Não foi possível criar o perfil.',
    };
  }

  if (input.sports.length > 0) {
    const { error: sportsError } = await supabase.from('user_sports').insert(
      input.sports.map((s) => ({
        user_id: userId,
        sport_id: s.sport_id,
        declared_level: s.declared_level,
      })),
    );
    if (sportsError) {
      return {
        ok: false,
        message: `Perfil criado, mas falhou guardar desportos: ${sportsError.message}`,
      };
    }
  }

  return { ok: true };
}
