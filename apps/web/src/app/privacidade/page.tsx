import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidade · S7VN',
  description: 'Política de privacidade do S7VN — que dados recolhemos e porquê.',
};

export default function PrivacyPolicy() {
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

        {/* PT */}
        <article id="pt" className="mt-8 max-w-none leading-relaxed">
          <h1 className="text-3xl font-bold sm:text-4xl">Política de Privacidade</h1>
          <p className="text-sm text-white/50">Versão de 14 de Maio de 2026</p>

          <h2 className="mt-10 text-xl font-bold">1. Quem somos</h2>
          <p className="text-white/75">
            O S7VN é uma aplicação de futebol amador desenvolvida e operada por José Pedro Almeida Brás,
            programador independente em Coimbra, Portugal. Quando esta política fala em &quot;nós&quot;
            referimos a ele enquanto responsável pelo tratamento de dados.
          </p>

          <h2 className="mt-8 text-xl font-bold">2. Que dados recolhemos</h2>
          <p className="text-white/75">Quando crias conta e usas a app, recolhemos:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li><strong>Conta:</strong> email, password (encriptada), data de criação.</li>
            <li><strong>Perfil:</strong> nome, alcunha opcional, fotografia opcional, cidade, posição preferida, número de camisola, pé preferido.</li>
            <li><strong>Jogos:</strong> participação em jogos, resultados, golos, assistências, MVP.</li>
            <li><strong>Reviews:</strong> avaliações que dás a equipas adversárias e comentários textuais (sempre anónimos para o destinatário).</li>
            <li><strong>Votos de atributos:</strong> valores que tu (ou amigos teus) votam nos teus atributos S7VN.</li>
            <li><strong>Equipas:</strong> equipas que crias ou onde estás registado como jogador, sub-capitão ou treinador.</li>
            <li><strong>Push notifications:</strong> token do dispositivo (se autorizares), para te avisar de jogos e mensagens.</li>
            <li><strong>Técnicos:</strong> logs de acesso (data, IP, user-agent) guardados pelo Supabase por segurança.</li>
          </ul>
          <p className="text-white/75">
            <strong>Não recolhemos:</strong> dados de localização em tempo real, contactos da agenda,
            histórico de navegação fora da app, dados de pagamento (a app é gratuita no MVP), nem dados sensíveis (saúde, política, religião, etc.).
          </p>

          <h2 className="mt-8 text-xl font-bold">3. Para que usamos</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>Fazer funcionar a app: marcação de jogos, plantel, reviews, rankings, etc.</li>
            <li>Comunicar contigo: confirmação de email, recuperação de password, avisos de jogo.</li>
            <li>Moderar conteúdo: comentários de reviews passam por verificação automática (OpenAI Moderation API) antes de ficarem visíveis.</li>
            <li>Melhorar a app: agregados anónimos para perceber o que funciona (ex: nº médio de jogos/equipa).</li>
            <li>Segurança: detectar e prevenir abuso, contas falsas, reviews maliciosas.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">4. Com quem partilhamos</h2>
          <p className="text-white/75">Usamos os seguintes processadores de dados:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li><strong>Supabase</strong> (base de dados e autenticação) — servidores na UE.</li>
            <li><strong>Resend</strong> (envio de emails transaccionais) — servidores na UE.</li>
            <li><strong>OpenAI</strong> (moderação automática de comentários textuais) — apenas o texto do comentário, sem identificadores pessoais associados.</li>
            <li><strong>Expo</strong> (push notifications) — token do dispositivo apenas.</li>
            <li><strong>Apple e Google</strong> (lojas de aplicações) — para distribuição da app.</li>
          </ul>
          <p className="text-white/75">
            Não vendemos os teus dados a anunciantes. Não há rastreamento publicitário de terceiros.
          </p>

          <h2 className="mt-8 text-xl font-bold">5. Reviews e anonimato</h2>
          <p className="text-white/75">
            As reviews que dás a equipas adversárias são <strong>anónimas para o destinatário</strong>.
            Internamente o sistema sabe quem reviewed quem (para evitar abuso e contagem dupla) mas essa associação
            nunca é mostrada na app nem partilhada com terceiros. Comentários textuais públicos podem ser reportados e removidos.
          </p>

          <h2 className="mt-8 text-xl font-bold">6. Onde estão os dados</h2>
          <p className="text-white/75">
            Tudo em servidores na União Europeia. Não há transferências internacionais excepto para a OpenAI
            (moderação) e para os servidores da Apple/Google quando descarregas a app.
          </p>

          <h2 className="mt-8 text-xl font-bold">7. Por quanto tempo</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>Conta activa: enquanto a usares.</li>
            <li>Conta apagada: o teu perfil é soft-deleted (marcado como apagado, deixa de ser visível) e os dados são purgados em 30 dias.</li>
            <li>Reviews e resultados de jogos: ficam anonimizados após apagares a conta (não desaparecem totalmente porque os adversários ficariam com histórico inconsistente — mas deixam de te identificar).</li>
            <li>Logs de segurança: 90 dias.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">8. Os teus direitos (GDPR)</h2>
          <p className="text-white/75">Tens direito a:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li>Aceder aos teus dados (vê o teu perfil dentro da app).</li>
            <li>Rectificar dados errados (editar perfil).</li>
            <li>Apagar a tua conta (no menu Perfil → Definições → Apagar conta).</li>
            <li>Exportar uma cópia dos teus dados (escreve para o email abaixo).</li>
            <li>Limitar ou opor-te ao tratamento.</li>
            <li>Apresentar queixa à CNPD (autoridade portuguesa de protecção de dados).</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">9. Idade mínima</h2>
          <p className="text-white/75">
            O S7VN é apenas para maiores de 18 anos. Não recolhemos conscientemente dados de menores. Se descobrires
            que um menor tem conta na app, avisa-nos.
          </p>

          <h2 className="mt-8 text-xl font-bold">10. Alterações</h2>
          <p className="text-white/75">
            Se mudarmos esta política avisamos por email e/ou notificação na app pelo menos 14 dias antes da alteração entrar em vigor.
          </p>

          <h2 className="mt-8 text-xl font-bold">11. Contacto</h2>
          <p className="text-white/75">
            Para qualquer questão sobre privacidade ou para exerceres os teus direitos, escreve para{' '}
            <a className="underline" href="mailto:josepedroalmeidabras@gmail.com">josepedroalmeidabras@gmail.com</a>.
          </p>
        </article>

        <hr className="my-16 border-white/10" />

        {/* EN */}
        <article id="en" className="max-w-none leading-relaxed">
          <h1 className="text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
          <p className="text-sm text-white/50">Version of 14 May 2026</p>

          <h2 className="mt-10 text-xl font-bold">1. Who we are</h2>
          <p className="text-white/75">
            S7VN is an amateur football app developed and operated by José Pedro Almeida Brás, an independent
            developer based in Coimbra, Portugal. Where this policy says &quot;we&quot;, it refers to him as
            the data controller.
          </p>

          <h2 className="mt-8 text-xl font-bold">2. What data we collect</h2>
          <p className="text-white/75">When you create an account and use the app, we collect:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li><strong>Account:</strong> email, password (encrypted), creation date.</li>
            <li><strong>Profile:</strong> name, optional nickname, optional photo, city, preferred position, jersey number, preferred foot.</li>
            <li><strong>Matches:</strong> participation, results, goals, assists, MVP votes.</li>
            <li><strong>Reviews:</strong> ratings and text comments you give opponent teams (always anonymous to the recipient).</li>
            <li><strong>Attribute votes:</strong> values that you (or your friends) vote on your S7VN attributes.</li>
            <li><strong>Teams:</strong> teams you create or where you are a player, sub-captain, or coach.</li>
            <li><strong>Push tokens:</strong> device token (if granted), for game and message notifications.</li>
            <li><strong>Technical:</strong> access logs (date, IP, user-agent) kept by Supabase for security.</li>
          </ul>
          <p className="text-white/75">
            <strong>We do not collect:</strong> real-time location, contacts, browsing history outside the app,
            payment data (free during MVP), or sensitive data (health, politics, religion, etc.).
          </p>

          <h2 className="mt-8 text-xl font-bold">3. How we use it</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>Run the app: scheduling, rosters, reviews, rankings, etc.</li>
            <li>Communicate with you: email confirmation, password reset, match alerts.</li>
            <li>Moderate content: review comments go through automated checks (OpenAI Moderation API) before becoming visible.</li>
            <li>Improve the app: anonymous aggregates to understand what works.</li>
            <li>Security: detect and prevent abuse, fake accounts, malicious reviews.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">4. Who we share with</h2>
          <p className="text-white/75">We use these data processors:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li><strong>Supabase</strong> (database and auth) — EU servers.</li>
            <li><strong>Resend</strong> (transactional email) — EU servers.</li>
            <li><strong>OpenAI</strong> (text comment moderation) — comment text only, no personal identifiers attached.</li>
            <li><strong>Expo</strong> (push notifications) — device token only.</li>
            <li><strong>Apple and Google</strong> (app stores) — for distribution.</li>
          </ul>
          <p className="text-white/75">
            We do not sell your data to advertisers. There is no third-party ad tracking.
          </p>

          <h2 className="mt-8 text-xl font-bold">5. Reviews and anonymity</h2>
          <p className="text-white/75">
            Ratings you give opponent teams are <strong>anonymous to the recipient</strong>. Internally the system knows
            who reviewed whom (to prevent abuse and double counting) but that link is never shown in the app
            or shared with third parties. Public text comments can be reported and removed.
          </p>

          <h2 className="mt-8 text-xl font-bold">6. Where data lives</h2>
          <p className="text-white/75">
            Everything sits on EU servers. No international transfers except for OpenAI (moderation) and Apple/Google
            (when you download the app).
          </p>

          <h2 className="mt-8 text-xl font-bold">7. Retention</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>Active account: as long as you use it.</li>
            <li>Deleted account: profile is soft-deleted (hidden) immediately and purged within 30 days.</li>
            <li>Reviews and match results: anonymised after deletion (kept to preserve opponents&apos; history but no longer linked to you).</li>
            <li>Security logs: 90 days.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">8. Your rights (GDPR)</h2>
          <p className="text-white/75">You have the right to:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li>Access your data (see your profile in the app).</li>
            <li>Correct inaccurate data (edit profile).</li>
            <li>Delete your account (Profile → Settings → Delete account).</li>
            <li>Export a copy of your data (write to the email below).</li>
            <li>Restrict or object to processing.</li>
            <li>Lodge a complaint with the CNPD (Portuguese data protection authority).</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">9. Minimum age</h2>
          <p className="text-white/75">
            S7VN is for adults aged 18 and over only. We do not knowingly collect data from minors. If you find that
            a minor has an account, let us know.
          </p>

          <h2 className="mt-8 text-xl font-bold">10. Changes</h2>
          <p className="text-white/75">
            If we change this policy we will notify you by email and/or in-app at least 14 days before changes take effect.
          </p>

          <h2 className="mt-8 text-xl font-bold">11. Contact</h2>
          <p className="text-white/75">
            For any privacy question or to exercise your rights, email{' '}
            <a className="underline" href="mailto:josepedroalmeidabras@gmail.com">josepedroalmeidabras@gmail.com</a>.
          </p>
        </article>

        <footer className="mt-16 flex items-center justify-between border-t border-white/10 pt-8 text-sm text-white/40">
          <Link href="/" className="hover:text-white">← S7VN</Link>
          <Link href="/termos" className="hover:text-white">Termos · Terms →</Link>
        </footer>
      </div>
    </main>
  );
}
