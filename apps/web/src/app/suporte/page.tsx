import Link from 'next/link';

export const metadata = {
  title: 'Apoio · S7VN',
  description: 'Contacto e perguntas frequentes sobre o S7VN — a app de Futebol de 7 amador.',
};

const SUPPORT_EMAIL = 'suporte@s7vn.app';

export default function SupportPage() {
  return (
    <main className="flex flex-1 flex-col items-center bg-black text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16 sm:py-24">
        <nav className="flex items-center justify-between text-sm text-white/50">
          <Link href="/" className="hover:text-white">← S7VN</Link>
          <div className="flex gap-4">
            <a href="#pt" className="hover:text-white">PT</a>
            <a href="#en" className="hover:text-white">EN</a>
          </div>
        </nav>

        {/* ─────────────────────────── PT ─────────────────────────── */}
        <article id="pt" className="mt-8 max-w-none leading-relaxed">
          <h1 className="text-3xl font-bold sm:text-4xl">Apoio</h1>
          <p className="mt-3 text-white/75">
            Precisas de ajuda com o S7VN? Tens uma dúvida, sugestão ou queres
            reportar um problema? Escreve-nos.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm uppercase tracking-wider text-white/50">Contacto</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-2 inline-block text-2xl font-semibold text-[#C9A26B] hover:text-[#E0BD86]"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-3 text-sm text-white/60">
              Resposta tipicamente em 24-48h. Para denúncias urgentes (conduta de
              jogadores), indica o nome da equipa e a data do jogo.
            </p>
          </div>

          <h2 className="mt-12 text-xl font-bold">Perguntas frequentes</h2>

          <h3 className="mt-6 text-lg font-semibold text-white">Como crio conta?</h3>
          <p className="text-white/75">
            Abre a app S7VN, toca em &quot;Criar&quot;, indica email e password,
            confirma o email e completa o onboarding (nome, cidade, posição
            preferida).
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">Como marco um jogo?</h3>
          <p className="text-white/75">
            Precisas de estar numa equipa como capitão ou sub-capitão. Em
            &quot;Marcar jogo&quot; escolhes data, hora, local e equipa
            adversária — a outra equipa recebe convite e confirma.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">As minhas reviews são anónimas?</h3>
          <p className="text-white/75">
            Sim. O destinatário vê só agregados (estrelas e total de votos) e os
            comentários textuais aparecem sem identificação do autor. A
            moderação automática filtra linguagem ofensiva.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">Como apago a minha conta?</h3>
          <p className="text-white/75">
            Na app: <em>Perfil → Editar perfil → Apagar conta</em>. Os teus
            dados pessoais são removidos imediatamente; participação histórica
            em jogos é anonimizada (mantém-se o resultado, sem o teu nome).
            Também podes pedir apagamento por email para {SUPPORT_EMAIL}.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">Reportar um jogador</h3>
          <p className="text-white/75">
            Após cada jogo aparece a opção &quot;Reportar&quot; no resumo. Duas
            denúncias em jogos diferentes suspendem a conta automaticamente.
            Casos de assédio ou agressão podem ser enviados directamente para{' '}
            {SUPPORT_EMAIL}.
          </p>

          <h2 className="mt-12 text-xl font-bold">Mais informação</h2>
          <ul className="mt-3 list-disc pl-6 text-white/75">
            <li><Link href="/privacidade" className="text-[#C9A26B] hover:text-[#E0BD86]">Política de privacidade</Link></li>
            <li><Link href="/termos" className="text-[#C9A26B] hover:text-[#E0BD86]">Termos de utilização</Link></li>
          </ul>

          <p className="mt-12 text-sm text-white/40">
            Responsável: José Pedro Almeida Brás, Coimbra, Portugal.
          </p>
        </article>

        {/* ─────────────────────────── EN ─────────────────────────── */}
        <article id="en" className="mt-20 max-w-none leading-relaxed">
          <h1 className="text-3xl font-bold sm:text-4xl">Support</h1>
          <p className="mt-3 text-white/75">
            Need help with S7VN? Have a question, suggestion, or want to report
            an issue? Get in touch.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm uppercase tracking-wider text-white/50">Contact</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-2 inline-block text-2xl font-semibold text-[#C9A26B] hover:text-[#E0BD86]"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-3 text-sm text-white/60">
              Replies typically within 24-48h. For urgent reports (player
              conduct), include the team name and match date.
            </p>
          </div>

          <h2 className="mt-12 text-xl font-bold">FAQ</h2>

          <h3 className="mt-6 text-lg font-semibold text-white">How do I create an account?</h3>
          <p className="text-white/75">
            Open the S7VN app, tap &quot;Sign up&quot;, enter email and
            password, confirm your email, then complete onboarding (name, city,
            preferred position).
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">How do I schedule a match?</h3>
          <p className="text-white/75">
            You must be on a team as captain or sub-captain. In
            &quot;Schedule match&quot;, pick the date, time, location and
            opposing team — they receive an invite and confirm.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">Are my reviews anonymous?</h3>
          <p className="text-white/75">
            Yes. The recipient only sees aggregates (stars and total votes) and
            text comments appear without author identification. Automated
            moderation filters offensive language.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">How do I delete my account?</h3>
          <p className="text-white/75">
            In the app: <em>Profile → Edit profile → Delete account</em>. Your
            personal data is removed immediately; historical match participation
            is anonymised (the result remains, your name does not). You can
            also request deletion by emailing {SUPPORT_EMAIL}.
          </p>

          <h3 className="mt-6 text-lg font-semibold text-white">Reporting a player</h3>
          <p className="text-white/75">
            After each match a &quot;Report&quot; option appears in the
            summary. Two reports across different matches automatically suspend
            the account. Harassment or assault cases can be sent directly to{' '}
            {SUPPORT_EMAIL}.
          </p>

          <h2 className="mt-12 text-xl font-bold">More information</h2>
          <ul className="mt-3 list-disc pl-6 text-white/75">
            <li><Link href="/privacidade" className="text-[#C9A26B] hover:text-[#E0BD86]">Privacy policy</Link></li>
            <li><Link href="/termos" className="text-[#C9A26B] hover:text-[#E0BD86]">Terms of use</Link></li>
          </ul>

          <p className="mt-12 text-sm text-white/40">
            Data controller: José Pedro Almeida Brás, Coimbra, Portugal.
          </p>
        </article>
      </div>
    </main>
  );
}
