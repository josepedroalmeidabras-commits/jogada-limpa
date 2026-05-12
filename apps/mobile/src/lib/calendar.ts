import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export type CalendarEventInput = {
  title: string;
  scheduled_at: string;
  location?: string | null;
  durationMinutes?: number;
  notes?: string;
};

export async function addMatchToCalendar(
  ev: CalendarEventInput,
): Promise<{ ok: true; eventId: string } | { ok: false; message: string }> {
  if (Platform.OS === 'web') {
    return { ok: false, message: 'Calendário não disponível em web.' };
  }

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    return { ok: false, message: 'Sem permissão para o calendário.' };
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const editable = calendars.find((c) => c.allowsModifications);
  const fallback = calendars[0];
  const cal = editable ?? fallback;
  if (!cal) {
    return { ok: false, message: 'Sem calendário disponível.' };
  }

  const start = new Date(ev.scheduled_at);
  const end = new Date(start.getTime() + (ev.durationMinutes ?? 90) * 60 * 1000);

  try {
    const eventId = await Calendar.createEventAsync(cal.id, {
      title: ev.title,
      startDate: start,
      endDate: end,
      location: ev.location ?? undefined,
      notes: ev.notes ?? 'Marcado via Jogada Limpa',
      alarms: [{ relativeOffset: -60 }],
    });
    return { ok: true, eventId };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Erro ao guardar.',
    };
  }
}

export async function addMatchesBulkToCalendar(
  events: CalendarEventInput[],
): Promise<
  | { ok: true; added: number; skipped: number }
  | { ok: false; message: string }
> {
  if (Platform.OS === 'web') {
    return { ok: false, message: 'Calendário não disponível em web.' };
  }
  if (events.length === 0) {
    return { ok: true, added: 0, skipped: 0 };
  }

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    return { ok: false, message: 'Sem permissão para o calendário.' };
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const cal =
    calendars.find((c) => c.allowsModifications) ?? calendars[0];
  if (!cal) {
    return { ok: false, message: 'Sem calendário disponível.' };
  }

  let added = 0;
  let skipped = 0;
  for (const ev of events) {
    const start = new Date(ev.scheduled_at);
    const end = new Date(
      start.getTime() + (ev.durationMinutes ?? 90) * 60 * 1000,
    );
    try {
      await Calendar.createEventAsync(cal.id, {
        title: ev.title,
        startDate: start,
        endDate: end,
        location: ev.location ?? undefined,
        notes: ev.notes ?? 'Marcado via Jogada Limpa',
        alarms: [{ relativeOffset: -60 }],
      });
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  return { ok: true, added, skipped };
}
