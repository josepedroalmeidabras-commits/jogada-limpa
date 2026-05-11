# Jogada Limpa

App para equipas de futebol amador marcarem jogos com adversários do seu nível — e saberem o que esperar antes de chegar ao campo.

**Estado:** scaffolding (Fase 1 do MVP — beta fechado em Coimbra, ~50 users, 14 semanas)

---

## Estrutura

```
jogada-limpa/
├── apps/
│   ├── mobile/         # Expo SDK 54 (React Native + TypeScript)
│   └── web/            # Next.js 16 + Tailwind v4 (landing + admin futuro)
├── packages/
│   └── shared/         # Tipos TypeScript + zod schemas partilhados
├── supabase/
│   ├── migrations/     # SQL schema (0001_init.sql)
│   └── functions/      # Edge Functions (a criar: moderação, push, cron)
├── package.json        # workspaces raiz (npm workspaces)
└── tsconfig.base.json  # config TS partilhada
```

---

## Setup inicial — 1ª vez

### Requisitos
- Node.js 20+
- Git
- App Expo Go no telemóvel ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

### Passos

1. **Instala dependências** (já feito uma vez, mas se mudares de máquina):
   ```bash
   cd ~/dev/jogada-limpa
   npm install
   ```

2. **Cria o projeto no Supabase**:
   - Vai a [supabase.com](https://supabase.com) → Sign in with GitHub
   - "New project" → nome "jogada-limpa", região: West Europe (Lisboa ou Londres mais próxima de Portugal)
   - Guarda a password do Postgres num gestor de passwords
   - Espera ~2 min a provisionar
   - Vai a **Project Settings → API** e copia:
     - `Project URL`
     - `anon` `public` key

3. **Corre o schema SQL no Supabase**:
   - No painel Supabase, vai a **SQL Editor** → "New query"
   - Cola o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   - Carrega em **Run** (Cmd+Enter)
   - Verifica em **Database → Tables** que apareceram ~14 tabelas

4. **Configura variáveis de ambiente** — copia `.env.example` para os dois locais:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp apps/mobile/.env.example apps/mobile/.env
   ```
   Edita ambos os ficheiros e preenche com os valores do passo 2.

5. **Cria conta na Vercel** (para o deploy do landing):
   - [vercel.com](https://vercel.com) → Sign in with GitHub
   - Import do repo será feito depois de fazermos push para GitHub

---

## Como correr

### Web (landing page)
```bash
npm run web
```
Abre http://localhost:3000

### Mobile (Expo)
```bash
npm run mobile
```
- QR code aparece no terminal
- No telemóvel: abre **Expo Go** → "Scan QR code"
- A app abre directamente no telemóvel com hot reload

### Atalhos úteis
```bash
npm run web:build           # build de produção do web
npm run mobile:ios          # simulador iOS (precisa de Xcode)
npm run mobile:android      # emulador Android (precisa de Android Studio)
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Mobile | React Native 0.81 + Expo SDK 54 + TypeScript |
| Web | Next.js 16 + React 19 + Tailwind v4 |
| Auth + DB + Storage | Supabase (Postgres 15 + PostGIS) |
| Validação | Zod (no `packages/shared`) |
| Estado servidor | TanStack Query |
| Estado cliente | Zustand |
| Push | Expo Notifications |
| Email transacional | Resend (a configurar) |
| Hosting web | Vercel |
| Repo | GitHub (a criar) |

---

## Decisões de produto fechadas (resumo)

- **+18 only**, sem dados de menores
- **Futebol 5/7/11 no MVP** — padel fica para Fase 2 (schema preparado)
- **Cidade-piloto:** Coimbra
- **Reviews bilaterais ocultas**, 4 categorias (fair play, pontualidade, nível, atitude) + comentário 200 chars anónimo com moderação OpenAI
- **ELO automático** por jogador, K-factor adaptativo
- **Slot "à procura de jogador"** disponível no MVP
- **Contraproposta de jogo** aceite
- **Local "a combinar"** permitido em marcações
- **Capitão convoca plantel** manualmente (não auto-convite)
- **Disputas de resultado** → founder modera manualmente no MVP

Spec completa: ver memória do projeto em `~/.claude/projects/-Users-josebras/memory/project_jogada_limpa.md`

---

## Próximos passos técnicos

- [ ] Push para GitHub (criar repo `jogada-limpa`)
- [ ] Criar projeto Supabase + correr migration 0001
- [ ] Configurar Auth (email/password + magic link)
- [ ] Implementar fluxo de signup (S1.1–S1.8 dos wireframes)
- [ ] NativeWind no mobile (Tailwind para RN)
- [ ] Navigation (expo-router)
- [ ] Tela de criar equipa
- [ ] Tela de marcar jogo

## Próximos passos não-técnicos (founder)

- [ ] Comprar `jogadalimpa.pt` (registar em [PTisp](https://ptisp.pt) ou [Dominios.pt](https://dominios.pt))
- [ ] Identificar 10-15 capitães de equipa F5/F7 em Coimbra para o beta
- [ ] Pesquisar marca "Jogada Limpa" em [INPI](https://servicosonline.inpi.pt/pesquisas/main/marcas.jsp?lang=PT) para confirmar disponibilidade
