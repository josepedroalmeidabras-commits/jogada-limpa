import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade — S7VN',
  description:
    'Como recolhemos, usamos e protegemos os teus dados na S7VN.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16 text-white/85">
      <div className="flex items-center justify-between text-sm text-white/40">
        <Link href="/" className="hover:text-white/80">
          ← S7VN
        </Link>
        <span>Última atualização: 12 maio 2026</span>
      </div>
      <h1 className="text-4xl font-bold text-white">
        Política de Privacidade
      </h1>
      <p className="text-white/60">
        Esta é uma versão preliminar para a fase de beta. Antes do lançamento
        público, será revista por um jurista. Se tiveres dúvidas, contacta-nos
        em{' '}
        <a
          href="mailto:josepedroalmeidabras@gmail.com"
          className="underline hover:text-white"
        >
          josepedroalmeidabras@gmail.com
        </a>
        .
      </p>

      <Section title="1. Quem somos">
        <p>
          A S7VN é uma aplicação destinada a maiores de 18 anos para a
          marcação de jogos de futebol amador entre equipas em Coimbra. O
          serviço é operado por José Pedro Almeida Bras como pessoa singular,
          contactável em josepedroalmeidabras@gmail.com.
        </p>
      </Section>

      <Section title="2. Que dados recolhemos">
        <ul className="ml-6 list-disc space-y-1">
          <li>Email e password (para autenticação)</li>
          <li>Nome e cidade (perfil público)</li>
          <li>Data de nascimento (para confirmação de +18; não é pública)</li>
          <li>Telemóvel, opcional (para contacto)</li>
          <li>Desportos jogados e nível auto-declarado</li>
          <li>
            Avaliações que submetes a outros utilizadores (anónimas para os
            avaliados)
          </li>
          <li>
            Histórico de jogos e resultados, e variações do teu ELO ao longo do
            tempo
          </li>
        </ul>
      </Section>

      <Section title="3. Para que usamos os dados">
        <ul className="ml-6 list-disc space-y-1">
          <li>Permitir-te entrar, marcar e participar em jogos</li>
          <li>Calcular e mostrar o teu nível (ELO) por desporto</li>
          <li>Mostrar a tua reputação agregada (sem identificar avaliadores)</li>
          <li>Resolver disputas e moderar abusos</li>
          <li>Comunicar contigo (lembretes de jogos, novidades)</li>
        </ul>
      </Section>

      <Section title="4. Com quem partilhamos">
        <p>
          Não vendemos dados a ninguém. Partilhamos com:
        </p>
        <ul className="ml-6 list-disc space-y-1">
          <li>Supabase — base de dados e autenticação (EU)</li>
          <li>Vercel — alojamento web (EU/US)</li>
          <li>Resend — envio de email transacional</li>
          <li>Expo / Apple / Google — distribuição da app móvel</li>
        </ul>
      </Section>

      <Section title="5. Retenção">
        <p>
          Mantemos a tua conta enquanto estiver ativa. Se eliminares a conta,
          os teus dados pessoais são apagados em 30 dias. Dados estatísticos
          agregados podem ser conservados de forma anonimizada.
        </p>
      </Section>

      <Section title="6. Os teus direitos (RGPD)">
        <ul className="ml-6 list-disc space-y-1">
          <li>Aceder aos teus dados</li>
          <li>Corrigir o que está incorreto</li>
          <li>Eliminar a conta</li>
          <li>Pedir uma cópia (portabilidade)</li>
          <li>Apresentar queixa à CNPD</li>
        </ul>
        <p>
          Para qualquer destes pedidos, envia email a
          josepedroalmeidabras@gmail.com.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          Usamos cookies estritamente técnicos (sessão, autenticação). Não
          usamos cookies de marketing ou tracking de terceiros nesta fase.
        </p>
      </Section>

      <Section title="8. Alterações">
        <p>
          Podemos atualizar esta política. Mudanças significativas serão
          comunicadas por email ou na app antes de entrarem em vigor.
        </p>
      </Section>

      <p className="mt-12 text-sm text-white/40">
        Ver também:{' '}
        <Link href="/termos" className="underline hover:text-white">
          Termos e Condições
        </Link>
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
      <div className="flex flex-col gap-2 text-white/75">{children}</div>
    </section>
  );
}
