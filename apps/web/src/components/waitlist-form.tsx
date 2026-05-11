'use client';

import { useActionState } from 'react';
import { joinWaitlist, type WaitlistState } from '@/app/actions/waitlist';

const initialState: WaitlistState = { status: 'idle' };

export function WaitlistForm() {
  const [state, formAction, pending] = useActionState(
    joinWaitlist,
    initialState,
  );

  if (state.status === 'success') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 text-center">
        <p className="text-base text-emerald-100">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <input
        type="email"
        name="email"
        required
        placeholder="o-teu@email.com"
        disabled={pending}
        className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-base text-white placeholder-white/40 outline-none focus:border-white/40 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-white px-6 py-3 text-base font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'A enviar…' : 'Lista de espera'}
      </button>
      {state.status === 'error' && (
        <p className="w-full text-sm text-red-300 sm:absolute sm:translate-y-14">
          {state.message}
        </p>
      )}
    </form>
  );
}
