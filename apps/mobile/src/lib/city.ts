import { supabase } from './supabase';

export type CityPulse = {
  matches_7d: number;
  active_teams: number;
  active_players: number;
};

export async function fetchCityPulse(city: string): Promise<CityPulse | null> {
  if (!city) return null;
  const { data, error } = await supabase
    .rpc('city_pulse', { p_city: city })
    .maybeSingle();
  if (error || !data) return null;
  const r = data as any;
  return {
    matches_7d: r.matches_7d ?? 0,
    active_teams: r.active_teams ?? 0,
    active_players: r.active_players ?? 0,
  };
}
