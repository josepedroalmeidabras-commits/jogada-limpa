'use server';

import { createClient } from '@/lib/supabase/server';

export type WaitlistState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const raw = formData.get('email');
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Email inválido.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('waitlist')
    .insert({ email, city: 'Coimbra', source: 'landing' });

  if (error) {
    if (error.code === '23505') {
      return { status: 'success', message: 'Já estás na lista. 👍' };
    }
    console.error('waitlist insert error', error);
    return {
      status: 'error',
      message: 'Não conseguimos guardar. Tenta de novo daqui a um bocado.',
    };
  }

  return {
    status: 'success',
    message: 'Estás dentro! Avisamos-te quando lançarmos em Coimbra.',
  };
}
