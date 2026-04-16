# ThumbForge AI

Arquitetura inicial de produto e sistema: [`docs/architecture/01-system-overview.md`](/abs/path/c:/Users/Vibratho/Documents/Projetos/UltraThumbMaker/docs/architecture/01-system-overview.md)

SaaS multi-tenant para criadores gerarem thumbnails com IA a partir de uma referencia visual, assets separados, configuracao de texto e instrucoes livres.

O repositório está organizado como monorepo com:

- `packages/frontend`: React + Vite + TypeScript + Tailwind
- `packages/backend`: Fastify + TypeScript + Prisma + BullMQ
- `packages/shared`: tipos e contratos compartilhados

## Status atual

Base do monorepo estruturada e validada com:

- `type-check` passando
- `build` passando
- `test` passando
- frontend e backend compilando no root

Partes já scaffoldadas:

- autenticacao com JWT + refresh token
- geracoes + assets + pipeline de IA
- pagamentos Mercado Pago
- downloads protegidos
- templates, planos e subscriptions
- filas com BullMQ
- schema Prisma MySQL

Observacao importante:

- as geracoes e webhooks dependem do worker do backend
- `npm run dev` e `npm run start` no root sobem frontend + API
- o worker ainda roda separadamente

## Requisitos

- Node.js `>= 20`
- `pnpm >= 9`
- MySQL
- Redis
- storage S3-compatible ou MinIO

Servicos externos opcionais para fluxo completo:

- OpenAI
- Mercado Pago
- SMTP

## Instalacao

Este monorepo usa `pnpm workspaces`. Para instalar corretamente, use:

```bash
pnpm install
```

Depois copie o arquivo de exemplo de ambiente:

- `.env.example` -> `.env`

Preencha pelo menos:

- `DATABASE_URL`
- `REDIS_URL`
- `STORAGE_*`
- `JWT_ACCESS_SECRET`
- `COOKIE_SECRET`

Para IA e pagamentos reais, configure tambem:

- `OPENAI_API_KEY`
- `MP_ACCESS_TOKEN`
- `MP_WEBHOOK_SECRET`

## Scripts do root

Voce pode usar os comandos abaixo no root do projeto:

```bash
npm run dev
npm run build
npm run start
```

O que cada um faz:

- `npm run dev`: roda frontend + backend em desenvolvimento
- `npm run build`: builda `shared`, `backend` e `frontend`
- `npm run start`: roda backend compilado + frontend em preview de producao

Tambem existem:

```bash
npm run type-check
npm run test
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:seed
npm run db:setup
npm run db:status
```

## Scripts uteis por pacote

Backend:

```bash
pnpm --filter @thumbforge/backend dev
pnpm --filter @thumbforge/backend start
pnpm --filter @thumbforge/backend worker:dev
pnpm --filter @thumbforge/backend worker:start
pnpm --filter @thumbforge/backend db:generate
pnpm --filter @thumbforge/backend db:migrate:dev
pnpm --filter @thumbforge/backend db:seed
```

Frontend:

```bash
pnpm --filter @thumbforge/frontend dev
pnpm --filter @thumbforge/frontend build
pnpm --filter @thumbforge/frontend start
```

## Fluxo local recomendado

### 1. Subir dependencias externas

Voce precisa ter MySQL, Redis e MinIO/S3 disponiveis antes de usar os fluxos principais.

### 2. Gerar o client Prisma

```bash
npm run db:generate
```

### 3. Aplicar migrations

Para ambiente local de desenvolvimento:

```bash
npm run db:migrate:dev
```

Para ambiente com migrations ja consolidadas:

```bash
npm run db:migrate
```

Para subir tudo de uma vez:

```bash
npm run db:setup
```

Se voce precisar aplicar a estrutura manualmente no MySQL, a migration inicial gerada esta em:

- [`packages/backend/prisma/migrations/20260415183000_init/migration.sql`](/abs/path/c:/Users/Vibratho/Documents/Projetos/UltraThumbMaker/packages/backend/prisma/migrations/20260415183000_init/migration.sql)

### 4. Rodar app

Em um terminal:

```bash
npm run dev
```

Em outro terminal, rode o worker:

```bash
pnpm --filter @thumbforge/backend worker:dev
```

## Portas padrao

- frontend: `http://localhost:3000`
- backend: `http://localhost:4000`

Healthchecks do backend:

- `GET /health`
- `GET /ready`

## Estrutura do projeto

```text
.
├─ packages/
│  ├─ backend/
│  │  ├─ prisma/
│  │  └─ src/
│  │     ├─ infrastructure/
│  │     ├─ modules/
│  │     ├─ shared/
│  │     └─ workers/
│  ├─ frontend/
│  │  └─ src/
│  │     ├─ components/
│  │     ├─ pages/
│  │     ├─ services/
│  │     ├─ stores/
│  │     └─ styles/
│  └─ shared/
│     └─ src/
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

## Modulos backend ja presentes

- `auth`
- `generations`
- `payments`
- `downloads`
- `templates`
- `plans`
- `subscriptions`

Infraestrutura existente:

- Prisma
- Redis
- BullMQ
- StorageService
- provider de IA abstrato
- provider OpenAI

## Frontend ja presente

Paginas atualmente criadas:

- landing
- login
- cadastro
- recuperacao de senha
- dashboard
- nova geracao
- resultados
- templates
- biblioteca
- historico
- configuracoes

## Ambiente

As variaveis documentadas estao em [`.env.example`](/abs/path/c:/Users/Vibratho/Documents/Projetos/UltraThumbMaker/.env.example).

## Validacao recente

Executado com sucesso:

```bash
pnpm type-check
pnpm build
pnpm test
```

## Pendencias naturais do proximo bloco

As proximas etapas mais importantes para deixar o sistema pronto para uso real sao:

- Docker e `docker-compose`
- deploy para EasyPanel
- worker integrado ao fluxo operacional
- testes de integracao para auth, pagamentos e webhooks
- bootstrap de dados iniciais com templates e planos
- ajustes finais de preview seguro e storage privado em ambiente real
