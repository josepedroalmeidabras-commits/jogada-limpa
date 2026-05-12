import { WaitlistForm } from '@/components/waitlist-form';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-black text-white">
      <section className="flex min-h-[90vh] w-full flex-col items-center justify-center px-6 py-24">
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
      </section>

      <section className="w-full border-t border-white/5 bg-zinc-950 px-6 py-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-12">
          <header className="flex flex-col items-center gap-3 text-center">
            <span className="text-xs uppercase tracking-widest text-white/40">
              Como funciona
            </span>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Três passos. Sem chats sem fim no WhatsApp.
            </h2>
          </header>
          <div className="grid gap-6 sm:grid-cols-3">
            <Step
              n={1}
              title="Cria ou entra numa equipa"
              body="És capitão? Cria e partilha um código. És jogador? Entra com o código que o teu capitão te passar."
            />
            <Step
              n={2}
              title="Marca um jogo"
              body="A app sugere adversários do teu nível. Escolhes data, hora, local — confirmas em dois toques."
            />
            <Step
              n={3}
              title="Joga e avalia"
              body="Pós-jogo, submetem resultado. ELO ajusta sozinho. Cada um avalia em 4 categorias — fair play, pontualidade, nível, atitude."
            />
          </div>
        </div>
      </section>

      <section className="w-full border-t border-white/5 px-6 py-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-12">
          <header className="flex flex-col items-center gap-3 text-center">
            <span className="text-xs uppercase tracking-widest text-white/40">
              Diferente
            </span>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Porquê esta app e não outra?
            </h2>
            <p className="max-w-2xl text-white/60">
              As outras apps marcam o campo. Esta marca o jogo. O nosso foco é{' '}
              <strong className="text-white">com quem</strong> jogas — não{' '}
              <strong className="text-white">onde</strong>.
            </p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feature
              icon="⚖️"
              title="Reviews bilaterais ocultas"
              body="Inspirado no Airbnb: a tua avaliação só fica visível depois de a outra parte também avaliar (ou após 72h). Sem retaliações."
            />
            <Feature
              icon="📊"
              title="ELO automático por jogador"
              body="Como no xadrez. Joga jogos validados — o sistema calcula o teu nível. Nada de auto-declarações enganadoras."
            />
            <Feature
              icon="🤝"
              title="Match por nível"
              body="A app sugere adversários equilibrados pela média de ELO da tua equipa. Mais jogos competitivos, menos goleadas."
            />
            <Feature
              icon="🛡️"
              title="+18 only, comunidade moderada"
              body="App exclusiva para adultos. Comentários abusivos são moderados. Capitães podem reportar maus jogadores."
            />
          </div>
        </div>
      </section>

      <section className="w-full border-t border-white/5 bg-zinc-950 px-6 py-24">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header className="flex flex-col items-center gap-3 text-center">
            <span className="text-xs uppercase tracking-widest text-white/40">
              Perguntas comuns
            </span>
            <h2 className="text-3xl font-bold sm:text-4xl">FAQ</h2>
          </header>
          <div className="flex flex-col gap-4">
            <Faq
              q="Custa dinheiro?"
              a="Não, na fase beta é gratuito. Quando lançar à séria pode haver versão paga para clubes e ligas amadoras, mas o uso individual continuará gratuito."
            />
            <Faq
              q="Que desportos suporta?"
              a="No lançamento: Futebol 5, 7 e 11. Padel, ténis e mais virão na fase seguinte."
            />
            <Faq
              q="Onde está disponível?"
              a="Beta fechado em Coimbra. Se quiseres em outra cidade, mete o email — quando tivermos massa crítica abrimos."
            />
            <Faq
              q="É preciso ter equipa fixa?"
              a="Sim, no início. Mais à frente vai poder ser substituto de equipas alheias se te declarares disponível."
            />
            <Faq
              q="Como confirmam o resultado?"
              a="Os dois capitães submetem. Se concordam, valida e o ELO atualiza. Se discordam, fica em disputa e a moderação resolve."
            />
          </div>
        </div>
      </section>

      <section className="flex w-full flex-col items-center gap-6 border-t border-white/5 px-6 py-24 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Pronto para começar?</h2>
        <p className="max-w-md text-white/60">
          Mete o email. Avisamos-te assim que abrir em Coimbra.
        </p>
        <WaitlistForm />
      </section>

      <footer className="flex w-full justify-between border-t border-white/5 px-6 py-8 text-xs text-white/30">
        <span>© 2026 Jogada Limpa · Coimbra</span>
        <div className="flex gap-6">
          <a href="/privacidade" className="hover:text-white/60">
            Privacidade
          </a>
          <a href="/termos" className="hover:text-white/60">
            Termos
          </a>
        </div>
      </footer>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Passo {n}
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-white/60">{body}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <span className="text-2xl">{icon}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-white/60">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 open:bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
        <span>{q}</span>
        <span className="text-white/40 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-white/60">{a}</p>
    </details>
  );
}
