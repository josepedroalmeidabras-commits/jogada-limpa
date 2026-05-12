import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos e Condições — Jogada Limpa',
  description: 'Regras de utilização da Jogada Limpa.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16 text-white/85">
      <div className="flex items-center justify-between text-sm text-white/40">
        <Link href="/" className="hover:text-white/80">
          ← Jogada Limpa
        </Link>
        <span>Última atualização: 12 maio 2026</span>
      </div>
      <h1 className="text-4xl font-bold text-white">Termos e Condições</h1>
      <p className="text-white/60">
        Versão preliminar para a fase de beta. Será revista juridicamente
        antes do lançamento público. Ao usar a Jogada Limpa, aceitas estes
        termos.
      </p>

      <Section title="1. +18">
        <p>
          A Jogada Limpa é exclusivamente para maiores de 18 anos. Ao criar
          conta, confirmas que tens 18 anos ou mais. Contas de menores serão
          eliminadas.
        </p>
      </Section>

      <Section title="2. Comportamento">
        <ul className="ml-6 list-disc space-y-1">
          <li>Trata os outros utilizadores com respeito.</li>
          <li>
            Não é permitido linguagem ofensiva, discriminação, ameaças, ou
            qualquer forma de abuso, nem em chat nem em avaliações.
          </li>
          <li>
            Avaliações maliciosas ou em retaliação podem levar à suspensão da
            conta.
          </li>
          <li>
            Submeter resultados falsos pode levar à anulação do jogo e
            penalização do ELO.
          </li>
        </ul>
      </Section>

      <Section title="3. Reviews">
        <p>
          As avaliações têm comentários anónimos (o avaliado nunca vê quem
          escreveu). Reservamo-nos o direito de moderar, ocultar ou remover
          comentários que violem estas regras.
        </p>
      </Section>

      <Section title="4. Responsabilidade">
        <ul className="ml-6 list-disc space-y-1">
          <li>
            A Jogada Limpa facilita a marcação. Não é organizadora dos jogos
            nem responsável por o que acontece em campo.
          </li>
          <li>
            És responsável pelas tuas ações, lesões em jogo, conflitos e
            danos materiais.
          </li>
          <li>
            Recomendamos seguro desportivo próprio. A Jogada Limpa não cobre
            acidentes.
          </li>
        </ul>
      </Section>

      <Section title="5. Conta">
        <ul className="ml-6 list-disc space-y-1">
          <li>És responsável pela tua password.</li>
          <li>Podes eliminar a conta a qualquer momento.</li>
          <li>
            Podemos suspender ou eliminar contas em violação destes termos.
          </li>
        </ul>
      </Section>

      <Section title="6. Propriedade">
        <p>
          O conteúdo gerado pelos utilizadores (perfil, avaliações, mensagens)
          continua propriedade dos utilizadores. Concedes à Jogada Limpa uma
          licença para o mostrar dentro da app.
        </p>
      </Section>

      <Section title="7. Alterações">
        <p>
          Podemos atualizar estes termos. Mudanças significativas serão
          comunicadas. Continuar a usar a app após a notificação significa
          aceitação dos novos termos.
        </p>
      </Section>

      <Section title="8. Contacto">
        <p>
          Para questões legais ou contestação de moderação:
          josepedroalmeidabras@gmail.com.
        </p>
      </Section>

      <p className="mt-12 text-sm text-white/40">
        Ver também:{' '}
        <Link href="/privacidade" className="underline hover:text-white">
          Política de Privacidade
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
