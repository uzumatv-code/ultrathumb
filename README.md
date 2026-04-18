# ThumbForge AI

Arquitetura inicial de produto e sistema: [docs/architecture/01-system-overview.md](docs/architecture/01-system-overview.md)

SaaS multi-tenant para criadores gerarem thumbnails com IA a partir de uma referencia visual, assets separados, configuracao de texto e instrucoes livres.

## Estrutura

O repositorio esta organizado como monorepo com:

- `packages/frontend`: React + Vite + TypeScript + Tailwind
- `packages/backend`: Fastify + TypeScript + Prisma + BullMQ
- `packages/shared`: tipos e contratos compartilhados

## Status atual

Base do monorepo estruturada e validada com:

- `type-check` passando
- `build` passando
- `test` passando
- frontend e backend compilando no root

Partes ja scaffoldadas:

- autenticacao com JWT + refresh token
- geracoes + assets + pipeline de IA
- pagamentos Mercado Pago
- downloads protegidos
- templates, planos e subscriptions
- filas com BullMQ
- schema Prisma MySQL

Observacoes importantes:

- as geracoes e webhooks dependem do worker do backend
- `npm run dev` e `npm run start` no root sobem frontend + API
- o worker ainda roda separadamente

## Requisitos

- Node.js `>= 20`
- `npm >= 9`
- MySQL
- Redis
- storage S3-compatible ou MinIO

Servicos externos opcionais para fluxo completo:

- OpenAI
- Mercado Pago
- SMTP

## Instalacao

Este monorepo usa `npm workspaces`. Para instalar corretamente, use:

```bash
npm install
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

Comandos principais no root:

```bash
npm run dev
npm run build
npm run start
```

Tambem existem:

```bash
npm run type-check
npm run test
npm run db:generate
npm run db:migrate
npm run db:migrate:dev
npm run db:push
npm run db:seed
npm run db:setup
npm run db:status
npm run db:studio
```

## Scripts por pacote

Backend:

```bash
npm run dev --workspace=@thumbforge/backend
npm run start --workspace=@thumbforge/backend
npm run worker:dev --workspace=@thumbforge/backend
npm run worker:start --workspace=@thumbforge/backend
npm run db:generate --workspace=@thumbforge/backend
npm run db:migrate:dev --workspace=@thumbforge/backend
npm run db:seed --workspace=@thumbforge/backend
```

Frontend:

```bash
npm run dev --workspace=@thumbforge/frontend
npm run build --workspace=@thumbforge/frontend
npm run start --workspace=@thumbforge/frontend
```

Shared:

```bash
npm run build --workspace=@thumbforge/shared
npm run dev --workspace=@thumbforge/shared
npm run type-check --workspace=@thumbforge/shared
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

- `packages/backend/prisma/migrations/20260415183000_init/migration.sql`

### 4. Rodar app

Em um terminal:

```bash
npm run dev
```

Em outro terminal, rode o worker:

```bash
npm run worker:dev --workspace=@thumbforge/backend
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
|-- packages/
|   |-- backend/
|   |   |-- prisma/
|   |   `-- src/
|   |       |-- infrastructure/
|   |       |-- modules/
|   |       |-- shared/
|   |       `-- workers/
|   |-- frontend/
|   |   `-- src/
|   |       |-- components/
|   |       |-- pages/
|   |       |-- services/
|   |       |-- stores/
|   |       `-- styles/
|   `-- shared/
|       `-- src/
|-- .env.example
|-- package-lock.json
|-- package.json
`-- turbo.json
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

As variaveis documentadas estao em `.env.example`.

## Validacao recente

Executado com sucesso:

```bash
npm run type-check
npm run build
npm run test
```

## Pendencias naturais do proximo bloco

As proximas etapas mais importantes para deixar o sistema pronto para uso real sao:

- Docker e `docker-compose`
- deploy para EasyPanel
- worker integrado ao fluxo operacional
- testes de integracao para auth, pagamentos e webhooks
- bootstrap de dados iniciais com templates e planos
- ajustes finais de preview seguro e storage privado em ambiente real
