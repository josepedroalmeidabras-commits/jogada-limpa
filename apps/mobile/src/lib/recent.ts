import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_USERS = 's7vn:recent_users';
const KEY_TEAMS = 's7vn:recent_teams';
const MAX = 8;

export type RecentEntry = {
  id: string;
  name: string;
  photo_url: string | null;
  meta?: string;
  at: number;
};

async function readKey(key: string): Promise<RecentEntry[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeKey(key: string, entries: RecentEntry[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(entries.slice(0, MAX)));
}

async function add(key: string, entry: Omit<RecentEntry, 'at'>): Promise<void> {
  const list = await readKey(key);
  const next = [
    { ...entry, at: Date.now() },
    ...list.filter((e) => e.id !== entry.id),
  ].slice(0, MAX);
  await writeKey(key, next);
}

export const recentUsers = {
  list: () => readKey(KEY_USERS),
  add: (entry: Omit<RecentEntry, 'at'>) => add(KEY_USERS, entry),
  clear: () => AsyncStorage.removeItem(KEY_USERS),
};

export const recentTeams = {
  list: () => readKey(KEY_TEAMS),
  add: (entry: Omit<RecentEntry, 'at'>) => add(KEY_TEAMS, entry),
  clear: () => AsyncStorage.removeItem(KEY_TEAMS),
};
