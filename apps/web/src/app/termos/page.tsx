import Link from 'next/link';

export const metadata = {
  title: 'Termos de Utilização · S7VN',
  description: 'Termos de utilização do S7VN.',
};

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold sm:text-4xl">Termos de Utilização</h1>
          <p className="text-sm text-white/50">Versão de 14 de Maio de 2026</p>

          <h2 className="mt-10 text-xl font-bold">1. O que é o S7VN</h2>
          <p className="text-white/75">
            O S7VN é uma aplicação móvel para jogadores e equipas amadoras de Futebol de 7 marcarem
            jogos entre si e trocarem reviews bilaterais sobre fair play, pontualidade e nível técnico.
            O serviço é fornecido por José Pedro Almeida Brás, Coimbra, Portugal.
          </p>

          <h2 className="mt-8 text-xl font-bold">2. Elegibilidade</h2>
          <p className="text-white/75">
            Tens de ter pelo menos <strong>18 anos</strong> para criar conta. Ao registares-te confirmas que cumpres este requisito.
          </p>

          <h2 className="mt-8 text-xl font-bold">3. Conta e responsabilidade</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>Tu és responsável por manter a tua password em segurança.</li>
            <li>Uma conta por pessoa — contas duplicadas são suspensas.</li>
            <li>Tens de usar o teu nome real (ou alcunha pública conhecida pelos teus colegas). Identidades falsas afectam o sistema de reviews e podem levar a banimento.</li>
            <li>Os dados que introduzes (resultados, plantel, posição, etc.) devem ser verdadeiros tanto quanto te lembres.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">4. Uso aceitável</h2>
          <p className="text-white/75">Não podes usar a app para:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li>Difamar, insultar ou ameaçar outros utilizadores (in-app, em reviews, ou em conteúdo gerado).</li>
            <li>Manipular reviews (combinar com outros para inflacionar ou rebaixar terceiros).</li>
            <li>Criar contas falsas, automatizar acções, ou fazer scraping.</li>
            <li>Publicar conteúdo discriminatório, sexual explícito, violento ou ilegal.</li>
            <li>Tentar comprometer a segurança do serviço.</li>
            <li>Recrutar para outras plataformas dentro de comentários de reviews.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">5. Reviews e comentários</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>As reviews que dás a equipas adversárias são anónimas para o destinatário.</li>
            <li>Comentários textuais passam por moderação automática (OpenAI Moderation API) antes de ficarem visíveis e podem ser reportados por outros utilizadores.</li>
            <li>Reviews atribuídas por má-fé (denegrindo um adversário por causa do resultado) violam estes termos.</li>
            <li>Após três comentários reportados e removidos, podes ser temporariamente suspenso.</li>
            <li>Após um jogo com denúncia válida ficas com aviso pendente; após dois jogos distintos com denúncia, a conta é suspensa.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">6. Conteúdo do utilizador</h2>
          <p className="text-white/75">
            Continuas dono do conteúdo que publicas (foto de perfil, nome de equipa, comentários, etc.).
            Concedes-nos uma licença limitada, não exclusiva, gratuita e revogável para mostrar esse conteúdo na app
            aos outros utilizadores. Podemos remover conteúdo que viole estes termos sem aviso prévio.
          </p>

          <h2 className="mt-8 text-xl font-bold">7. Suspensão e banimento</h2>
          <p className="text-white/75">
            Podemos suspender ou apagar a tua conta se violares estes termos. Tentamos avisar e ouvir-te primeiro,
            excepto em casos graves (ameaças, fraude). Tens direito a recurso por email.
          </p>

          <h2 className="mt-8 text-xl font-bold">8. Disponibilidade do serviço</h2>
          <p className="text-white/75">
            Esta é uma app em fase beta. Não garantimos disponibilidade contínua nem ausência de bugs. Podemos fazer
            manutenção, alterar funcionalidades ou descontinuar o serviço com 30 dias de aviso. Como utilizador beta
            ajudas-nos a identificar problemas — comunica-os pelo menu &quot;Reportar problema&quot; ou por email.
          </p>

          <h2 className="mt-8 text-xl font-bold">9. Limitação de responsabilidade</h2>
          <p className="text-white/75">
            O S7VN facilita o contacto entre equipas e jogadores mas <strong>não é parte</strong> dos jogos.
            Não somos responsáveis por:
          </p>
          <ul className="list-disc pl-6 text-white/75">
            <li>Lesões, conflitos físicos ou prejuízos materiais ocorridos durante jogos marcados via app.</li>
            <li>Reservas de campos, pagamentos entre jogadores, ou compromissos de comparência.</li>
            <li>Conteúdo gerado por outros utilizadores (incluindo reviews textuais).</li>
            <li>Indisponibilidade do serviço durante manutenção ou falhas de infraestrutura.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">10. Alterações destes termos</h2>
          <p className="text-white/75">
            Se mudarmos estes termos avisamos por email e/ou notificação na app pelo menos 14 dias antes. Se não concordares,
            podes apagar a conta antes da alteração entrar em vigor.
          </p>

          <h2 className="mt-8 text-xl font-bold">11. Lei aplicável</h2>
          <p className="text-white/75">
            Estes termos regem-se pela lei portuguesa. Qualquer litígio resolve-se nos tribunais portugueses,
            sem prejuízo dos teus direitos enquanto consumidor na UE.
          </p>

          <h2 className="mt-8 text-xl font-bold">12. Contacto</h2>
          <p className="text-white/75">
            Dúvidas? Escreve para{' '}
            <a className="underline" href="mailto:josepedroalmeidabras@gmail.com">josepedroalmeidabras@gmail.com</a>.
          </p>
        </article>

        <hr className="my-16 border-white/10" />

        {/* EN */}
        <article id="en" className="max-w-none leading-relaxed">
          <h1 className="text-3xl font-bold sm:text-4xl">Terms of Service</h1>
          <p className="text-sm text-white/50">Version of 14 May 2026</p>

          <h2 className="mt-10 text-xl font-bold">1. What S7VN is</h2>
          <p className="text-white/75">
            S7VN is a mobile app for amateur 7-a-side football players and teams to schedule matches and exchange
            bilateral reviews on fair play, punctuality, and technical level. The service is provided by
            José Pedro Almeida Brás, Coimbra, Portugal.
          </p>

          <h2 className="mt-8 text-xl font-bold">2. Eligibility</h2>
          <p className="text-white/75">
            You must be at least <strong>18 years old</strong> to create an account. By signing up you confirm you meet this requirement.
          </p>

          <h2 className="mt-8 text-xl font-bold">3. Account and responsibility</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>You are responsible for keeping your password safe.</li>
            <li>One account per person — duplicates get suspended.</li>
            <li>Use your real name (or a known public nickname). False identities undermine the review system and may lead to a ban.</li>
            <li>Data you enter (results, roster, position, etc.) should be truthful to the best of your knowledge.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">4. Acceptable use</h2>
          <p className="text-white/75">You may not use the app to:</p>
          <ul className="list-disc pl-6 text-white/75">
            <li>Defame, insult, or threaten other users (in-app, in reviews, or in any generated content).</li>
            <li>Manipulate reviews (collude to inflate or downrate others).</li>
            <li>Create fake accounts, automate actions, or scrape content.</li>
            <li>Post discriminatory, sexually explicit, violent, or illegal content.</li>
            <li>Attempt to compromise the service&apos;s security.</li>
            <li>Recruit for other platforms inside review comments.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">5. Reviews and comments</h2>
          <ul className="list-disc pl-6 text-white/75">
            <li>Ratings you give opponent teams are anonymous to the recipient.</li>
            <li>Text comments go through automated moderation (OpenAI Moderation API) before becoming visible and can be reported by other users.</li>
            <li>Bad-faith reviews (downrating opponents because of the result) violate these terms.</li>
            <li>After three reported and removed comments you may be temporarily suspended.</li>
            <li>After one match with a valid report you receive a pending warning; after two distinct matches with reports, your account is suspended.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">6. User content</h2>
          <p className="text-white/75">
            You own the content you post (profile photo, team name, comments, etc.). You grant us a limited,
            non-exclusive, free, revocable licence to display that content to other users inside the app.
            We may remove content violating these terms without prior notice.
          </p>

          <h2 className="mt-8 text-xl font-bold">7. Suspension and ban</h2>
          <p className="text-white/75">
            We may suspend or delete your account if you violate these terms. We try to notify and hear you first,
            except in serious cases (threats, fraud). You may appeal by email.
          </p>

          <h2 className="mt-8 text-xl font-bold">8. Service availability</h2>
          <p className="text-white/75">
            This is a beta-stage app. We do not guarantee continuous availability or absence of bugs. We may
            do maintenance, change features, or discontinue the service with 30 days&apos; notice. As a beta user
            you help us identify problems — report them via &quot;Report a problem&quot; in the app or by email.
          </p>

          <h2 className="mt-8 text-xl font-bold">9. Limitation of liability</h2>
          <p className="text-white/75">
            S7VN facilitates contact between teams and players but is <strong>not a party</strong> to the matches.
            We are not responsible for:
          </p>
          <ul className="list-disc pl-6 text-white/75">
            <li>Injuries, physical conflicts, or material damage during matches scheduled via the app.</li>
            <li>Field bookings, payments between players, or commitments to show up.</li>
            <li>Content posted by other users (including text reviews).</li>
            <li>Service unavailability during maintenance or infrastructure failures.</li>
          </ul>

          <h2 className="mt-8 text-xl font-bold">10. Changes to these terms</h2>
          <p className="text-white/75">
            If we change these terms we will notify you by email and/or in-app at least 14 days before changes
            take effect. If you disagree, you may delete your account before the change takes effect.
          </p>

          <h2 className="mt-8 text-xl font-bold">11. Governing law</h2>
          <p className="text-white/75">
            These terms are governed by Portuguese law. Any dispute will be settled in Portuguese courts,
            without prejudice to your rights as a consumer in the EU.
          </p>

          <h2 className="mt-8 text-xl font-bold">12. Contact</h2>
          <p className="text-white/75">
            Questions? Email{' '}
            <a className="underline" href="mailto:josepedroalmeidabras@gmail.com">josepedroalmeidabras@gmail.com</a>.
          </p>
        </article>

        <footer className="mt-16 flex items-center justify-between border-t border-white/10 pt-8 text-sm text-white/40">
          <Link href="/" className="hover:text-white">← S7VN</Link>
          <Link href="/privacidade" className="hover:text-white">Privacidade · Privacy →</Link>
        </footer>
      </div>
    </main>
  );
}
