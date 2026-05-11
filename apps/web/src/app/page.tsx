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
        <form className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <input
            type="email"
            placeholder="o-teu@email.com"
            className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-base outline-none focus:border-white/40"
            disabled
          />
          <button
            type="button"
            disabled
            className="rounded-full bg-white px-6 py-3 text-base font-medium text-black opacity-60"
          >
            Lista de espera
          </button>
        </form>
        <p className="text-sm text-white/40">
          Formulário ligado em breve — Supabase em configuração.
        </p>
      </main>
    </div>
  );
}
