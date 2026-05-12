import { supabase } from './supabase';

export type Profile = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
  birthdate: string;
  phone: string | null;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, photo_url, city, birthdate, phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('fetchProfile error', error);
    return null;
  }
  return data;
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
};

export async function updateProfile(
  userId: string,
  input: ProfileUpdate,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.phone !== undefined) patch.phone = input.phone;
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
