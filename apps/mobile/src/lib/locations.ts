import { supabase } from './supabase';

export type Location = {
  id: string;
  city: string;
  name: string;
  address: string | null;
};

export async function fetchLocationsByCity(city: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, city, name, address')
    .eq('city', city)
    .eq('is_active', true)
    .order('name');
  if (error || !data) return [];
  return data as Location[];
}
