import { supabase } from './supabase';

export type SearchedUser = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
  bio: string | null;
};

export type SuggestedFriend = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
  matches_shared: number;
};

export async function searchProfiles(
  query: string,
): Promise<SearchedUser[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('search_profiles', {
    p_query: q,
  });
  if (error || !data) {
    console.error('searchProfiles error', error);
    return [];
  }
  return data as SearchedUser[];
}

export type UniversalSearchResult = {
  kind: 'profile' | 'team';
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
  meta: string;
};

export async function searchAll(
  query: string,
): Promise<UniversalSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('search_all', { p_query: q });
  if (error || !data) {
    console.error('searchAll error', error);
    return [];
  }
  return data as UniversalSearchResult[];
}

export async function fetchSuggestedFriends(): Promise<SuggestedFriend[]> {
  const { data, error } = await supabase.rpc('suggested_friends', {
    p_limit: 20,
  });
  if (error || !data) {
    console.error('fetchSuggestedFriends error', error);
    return [];
  }
  return data as SuggestedFriend[];
}
