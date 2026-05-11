import { WaitlistForm } from '@/components/waitlist-form';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-black px-6 text-white">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
          Em breve em Coimbra
        </span>
        <h1 className="text-5xl font-bold leading-tight sm:text-6xl">
          Jogada Limpa
        </h1>
        <p className="max-w-md text-lg text-white/70">
          A app para equipas de futebol amador marcarem jogos com adversários
          do seu nível — e saberem o que esperar antes de chegar ao campo.
        </p>
        <WaitlistForm />
        <p className="text-sm text-white/40">
          Beta fechado em breve. Sem spam.
        </p>
      </main>
    </div>
  );
}
