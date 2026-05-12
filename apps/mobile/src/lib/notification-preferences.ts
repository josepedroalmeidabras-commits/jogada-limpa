import { supabase } from './supabase';

export type NotificationPreferences = {
  user_id: string;
  match_invite_push: boolean;
  match_invite_email: boolean;
  match_confirmed_push: boolean;
  reminder_24h_push: boolean;
  reminder_2h_push: boolean;
  result_pending_push: boolean;
  result_pending_email: boolean;
  review_pending_push: boolean;
  review_pending_email: boolean;
  weekly_digest_email: boolean;
  marketing_email: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export async function fetchNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchNotificationPreferences error', error);
    return null;
  }
  if (data) return data as NotificationPreferences;

  // No row yet — create with defaults
  const { data: inserted, error: insertError } = await supabase
    .from('notification_preferences')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (insertError) {
    console.error('insert notification_preferences error', insertError);
    return null;
  }
  return inserted as NotificationPreferences;
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'user_id'>>,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('notification_preferences')
    .update(patch)
    .eq('user_id', userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
