# ThumbForge AI: Arquitetura Geral e Organizacao Macro

## Objetivo Arquitetural

O produto nao deve ser apenas um gerador de imagens por prompt. A arquitetura precisa suportar cinco capacidades centrais:

1. `composition engine`: gerar thumbnails com composicao consistente e foco em CTR.
2. `semantic editor`: permitir alteracoes localizadas sem reiniciar todo o processo.
3. `art direction assistant`: analisar referencias, sugerir melhorias e manter coerencia visual.
4. `template system`: transformar estilos e layouts em estruturas reutilizaveis.
5. `versioned creative workflow`: cada tentativa, refinamento e exportacao precisa ser rastreavel.

## Decisao de Plataforma

Para este repositório, a melhor direcao e uma evolucao do monorepo atual, nao um rewrite imediato.

- `frontend`: manter React + TypeScript no curto prazo, com evolucao da arquitetura de paginas para editor/produto premium.
- `backend`: manter Fastify + workers separados, porque IA, filas, storage e processamento pesado pedem fronteiras claras.
- `queue`: Redis + workers especializados continua sendo a escolha correta.
- `storage`: S3 compativel continua correto para assets, previews, exports e derivados.
- `database`: o estado atual usa Prisma + MySQL. A arquitetura alvo deve ser modelada de forma compativel com Prisma, mas com desenho preparado para uma migracao futura para PostgreSQL se quisermos explorar melhor `JSONB`, busca e analytics mais ricos.

Resumo: vamos tratar o sistema como um `creative operating system` com API de produto, workers de IA/processamento e um frontend orientado a fluxo criativo.

---

## Visao de Alto Nivel

```text
[Frontend SaaS]
  |-- Dashboard / Projects / Templates / Results / Semantic Editor
  |-- Realtime status / progress / refinement controls
  |
  v
[Product API - Fastify]
  |-- Auth / Workspaces / Projects / Thumbnails / Templates / Billing
  |-- Orchestration endpoints
  |-- Reference analysis requests
  |-- Semantic edit requests
  |-- Export requests
  |
  +--> [Post/Queue Commands] --> [Redis / BullMQ]
                               |-- generation jobs
                               |-- reference analysis jobs
                               |-- semantic edit jobs
                               |-- finishing/export jobs
                               |-- notification jobs
                               v
                        [Workers]
                          |-- AI Generation Worker
                          |-- Reference Analyzer Worker
                          |-- Asset Processing Worker
                          |-- Semantic Edit Worker
                          |-- Thumbnail Finisher Worker
                          |-- Export Worker
                          |
                          +--> [AI Providers]
                          +--> [Vision / Segmentation / Face / OCR]
                          +--> [Sharp / Image Pipeline]
                          +--> [Storage]

[Database]
  |-- users / workspaces / projects
  |-- thumbnails / versions / edit operations
  |-- templates / template layers / style presets
  |-- reference analyses / prompts / jobs / exports
  |-- subscriptions / usage / audit

[Object Storage]
  |-- raw uploads
  |-- cutouts / masks / previews
  |-- generated variants
  |-- finished exports
  |-- template assets
```

---

## Macro Modulos do Produto

### 1. Identity, Workspace and Billing

Responsavel por contexto de conta e monetizacao.

- autenticacao
- usuarios e papeis
- workspaces
- limites de plano
- billing e subscriptions
- controle de uso por geracao, refinamento, upscale e export

Esse modulo protege o resto do sistema e define o contexto de tenant/workspace para assets, projetos e templates.

### 2. Project Studio

Modulo principal de produto.

- cria e organiza projetos criativos
- agrupa uploads, referencias, thumbs e versoes
- define qual thumbnail/version e a base atual
- armazena o historico completo do fluxo criativo

Unidade de negocio recomendada:

- `workspace` -> dono e equipe
- `project` -> contexto de um video/campanha
- `thumbnail` -> conceito criativo
- `thumbnail_version` -> cada geracao/refino/export derivado

### 3. Template Engine

Nao deve armazenar apenas uma imagem de exemplo. O template precisa ser uma estrutura interpretavel.

Deve conter:

- metadados de nicho/categoria
- regras de composicao
- layout base
- zonas semanticas
- estilo visual
- paleta
- regras de texto
- glow/energia/densidade
- presets de acabamento

O template passa a ser um `layout recipe`, nao um simples asset.

### 4. Asset Processor

Pipeline de preparacao e validacao dos inputs do usuario.

Responsabilidades:

- upload
- validacao de resolucao
- deteccao de rosto
- segmentacao e remocao de fundo
- pose estimation
- quality checks
- score de qualidade do asset
- recomendacoes antes da geracao

Saidas importantes:

- cutout do sujeito
- face bbox
- pose landmarks
- mascara
- score de qualidade
- alertas

### 5. Reference Analyzer

Extrai o `DNA visual` de uma thumbnail de referencia.

Responsabilidades:

- detectar composicao
- identificar hierarquia visual
- detectar sujeito principal
- estimar emocao facial
- extrair paleta dominante
- avaliar densidade visual
- medir legibilidade em miniatura
- detectar objetos e espaco de texto
- classificar estilo visual

Saida:

- JSON estruturado reutilizavel pelo Prompt Builder, pelo Suggestion Engine e pelo Semantic Editor.

### 6. Prompt Builder

O sistema nao deve depender de um unico prompt textual. Precisamos de um `structured creative spec`.

Entradas:

- template
- referencia analisada
- assets enviados
- estilo escolhido
- nicho
- emocao
- texto desejado
- objetivo de CTR
- alteracoes semanticas

Saidas:

- prompt textual final para modelo generativo
- spec estruturada da composicao
- negative constraints
- preservation constraints
- directives por zona

Esse modulo e o coracao da consistencia do produto.

### 7. Variant Generator

Gera familias de variacoes de forma controlada.

Abordagens iniciais:

- conservative
- viral
- clean
- dramatic
- premium
- extreme

Cada variante precisa carregar:

- creative intent
- diferencas de composicao
- justificativa visual
- seed/config
- score inicial

### 8. Semantic Editor

Modulo mais estrategico para diferenciacao.

Ele recebe comandos de alto nivel e transforma em operacoes estruturadas.

Exemplos:

- trocar so a pessoa
- aumentar rosto
- reduzir poluicao visual
- reforcar objeto principal
- mudar fundo
- alterar cor dominante
- trocar expressao
- inserir texto

Esse modulo precisa trabalhar com:

- `preserve zones`
- `change zones`
- `layout locks`
- `subject locks`
- `palette shifts`
- `style delta`

Ele nunca deve tratar uma edicao pequena como uma regeneracao cega.

### 9. Thumbnail Finisher

Pipeline final focado em qualidade perceptiva para YouTube.

Responsabilidades:

- upscale
- sharpen controlado
- face enhancement leve
- contraste para miniatura
- separacao sujeito/fundo
- glow refinement
- color grading final
- exportacao 1280x720
- variantes opcionais 1:1, 9:16 e 4:5

### 10. Scoring and Suggestion Engine

Motor de avaliacao visual e recomendacoes.

Ele nao substitui teste real de CTR, mas deve elevar a qualidade media.

Scores internos:

- legibilidade facial
- dominancia do sujeito
- destaque do objeto principal
- contraste
- poluicao visual
- aproveitamento do espaco para texto
- energia visual
- consistencia com template ou referencia

Sugestoes:

- rosto pequeno demais
- muitos elementos competindo
- falta contraste
- fundo dominante demais
- texto sem area limpa
- expressao pouco intensa

### 11. Export and Delivery

Modulo de entrega final.

- gerar pacote final
- registrar metadados de export
- disponibilizar formatos
- manter historico de exports
- preparar webhook/integração futura com YouTube ou ferramentas externas

### 12. Observability and Audit

Como estamos construindo um SaaS criativo com IA, observabilidade nao e opcional.

- trilha de prompts
- trilha de edicoes
- tempo por etapa
- custo por geracao
- taxa de falha por provider
- auditoria por workspace
- eventos de produto

---

## Fronteiras Tecnicas dos Modulos

### API Sincrona

Responsavel por:

- autenticar
- validar requests
- criar projetos e thumbnails
- armazenar comandos do usuario
- enfileirar jobs
- retornar estado atual

Ela nao deve executar processamento pesado de IA diretamente, exceto fallback controlado de desenvolvimento.

### Workers Assincronos

Separacao recomendada:

- `generation-worker`: geracao inicial de variantes
- `analysis-worker`: analise de referencia e scoring
- `asset-worker`: segmentacao, pose, face, quality checks
- `edit-worker`: semantic edits e local regeneration
- `finisher-worker`: upscale, sharpen, export
- `notification-worker`: email, alertas, realtime fanout

### Camada de Dominio

O backend deve evoluir de `modules` mais genericos para `bounded contexts` mais claros.

Sugestao de contextos:

- `identity`
- `workspace`
- `catalog`
- `creative-studio`
- `ai-orchestration`
- `billing`
- `delivery`
- `platform`

---

## Fluxo Macro de Criacao

### Fluxo A: Reference-led Creation

1. usuario cria projeto
2. envia referencia
3. `reference-analyzer` extrai DNA visual
4. envia foto da pessoa e objetos
5. `asset-processor` prepara inputs
6. usuario escolhe o que preservar
7. `prompt-builder` gera creative spec
8. `variant-generator` cria 3 a 6 variacoes
9. `scoring-engine` avalia e ranqueia
10. usuario seleciona base
11. `semantic-editor` aplica refinamentos localizados
12. `thumbnail-finisher` prepara export final

### Fluxo B: Template-led Creation

1. usuario escolhe template
2. sistema carrega recipe estrutural
3. usuario envia assets
4. `asset-processor` valida
5. `prompt-builder` monta composicao guiada
6. `variant-generator` cria variacoes coerentes com o template
7. `semantic-editor` refina
8. `finisher` exporta

### Fluxo C: Guided Creation

1. usuario responde wizard
2. sistema monta creative brief
3. `prompt-builder` gera spec
4. `variant-generator` produz primeiras propostas
5. `suggestion-engine` oferece melhorias
6. usuario refina
7. exporta

---

## Estrategia de Organizacao do Monorepo

### Estrutura atual

O projeto hoje ja tem:

- `packages/frontend`
- `packages/backend`
- `packages/shared`

Essa base continua boa. A mudanca importante e a organizacao interna de cada pacote.

### Estrutura alvo proposta

```text
.
├── docs/
│   ├── architecture/
│   │   ├── 01-system-overview.md
│   │   ├── 02-domain-model.md
│   │   ├── 03-api-and-jobs.md
│   │   └── 04-ui-editor-workflows.md
│   └── product/
│       ├── creative-flows.md
│       └── template-authoring.md
├── packages/
│   ├── frontend/
│   │   └── src/
│   │       ├── app/
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── dashboard/
│   │       │   ├── projects/
│   │       │   ├── templates/
│   │       │   ├── generation-wizard/
│   │       │   ├── results-gallery/
│   │       │   ├── semantic-editor/
│   │       │   ├── exports/
│   │       │   └── billing/
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   ├── layout/
│   │       │   ├── media/
│   │       │   └── editor/
│   │       ├── services/
│   │       ├── stores/
│   │       ├── hooks/
│   │       ├── styles/
│   │       ├── utils/
│   │       └── types/
│   ├── backend/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── http/
│   │       │   ├── jobs/
│   │       │   └── events/
│   │       ├── domains/
│   │       │   ├── identity/
│   │       │   ├── workspace/
│   │       │   ├── templates/
│   │       │   ├── assets/
│   │       │   ├── reference-analysis/
│   │       │   ├── prompt-builder/
│   │       │   ├── generation/
│   │       │   ├── semantic-edits/
│   │       │   ├── finisher/
│   │       │   ├── exports/
│   │       │   ├── scoring/
│   │       │   ├── projects/
│   │       │   ├── notifications/
│   │       │   └── billing/
│   │       ├── infrastructure/
│   │       │   ├── ai/
│   │       │   ├── database/
│   │       │   ├── storage/
│   │       │   ├── queue/
│   │       │   ├── cache/
│   │       │   ├── email/
│   │       │   ├── websocket/
│   │       │   ├── telemetry/
│   │       │   └── image/
│   │       ├── shared/
│   │       └── workers/
│   │           ├── generation/
│   │           ├── analysis/
│   │           ├── asset-processing/
│   │           ├── semantic-edits/
│   │           ├── finishing/
│   │           └── notifications/
│   └── shared/
│       └── src/
│           ├── contracts/
│           ├── dto/
│           ├── enums/
│           ├── schemas/
│           ├── ai/
│           └── editor/
└── package.json
```

---

## Como Evoluir a Estrutura Atual sem Reescrever Tudo

### Backend

Hoje:

- `modules/auth`
- `modules/generations`
- `modules/templates`
- `infrastructure/ai`
- `infrastructure/storage`

Evolucao sugerida:

- manter `modules` como camada de entrada/transicao no curto prazo
- introduzir `domains/` para regras de negocio novas
- mover regras complexas de IA para `domains/generation`, `domains/reference-analysis`, `domains/semantic-edits`
- deixar `infrastructure/` apenas com adaptadores externos

Regra pratica:

- se a logica fala de negocio criativo, vai para `domains`
- se a logica fala de OpenAI, Redis, S3, Prisma, vai para `infrastructure`

### Frontend

Hoje:

- `pages`
- `components`
- `services`

Evolucao sugerida:

- manter `pages` enquanto a navegacao ainda e simples
- mover a UI de produto para `features`
- reservar `components/ui` para componentes puros
- reservar `components/editor` para canvas, overlays, comparison slider, crop zones e semantic controls

Regra pratica:

- `components/ui`: botoes, cards, dialogs, inputs
- `features/*`: fluxo de negocio da tela
- `components/editor`: blocos do studio visual

---

## Contratos Internos Criticos

Mesmo antes da modelagem detalhada de banco, os seguintes contratos precisam existir como tipos compartilhados:

- `ReferenceAnalysis`
- `TemplateRecipe`
- `CreativeBrief`
- `PromptBuildInput`
- `PromptBuildOutput`
- `SemanticEditRequest`
- `VariantGenerationStrategy`
- `ThumbnailScoreCard`
- `ThumbnailVersionGraph`
- `AssetQualityReport`
- `ExportProfile`

Esses contratos devem morar em `packages/shared/src`.

---

## Pilares de Escalabilidade

### 1. Separacao entre request e processamento

Nenhuma geracao importante deve depender de request HTTP aberto.

### 2. Idempotencia de jobs

Toda operacao de IA ou export precisa poder ser reexecutada com seguranca.

### 3. Versionamento total

Cada versao gerada deve saber:

- quem originou
- qual base usou
- qual operacao gerou
- quais assets alimentaram
- qual template ou referencia influenciou
- qual prompt estruturado foi usado

### 4. Provider abstraction

O produto nao pode ficar acoplado a um unico provedor.

Precisamos de fronteiras para:

- image generation
- vision analysis
- segmentation
- upscaling
- OCR

### 5. Progressive enhancement

O sistema deve funcionar em niveis:

- MVP: geracao + templates + refinamentos simples
- v2: analysis mais rico + local edits melhores
- v3: canvas semantico e autosuggestions mais sofisticadas

---

## Decisoes de Produto que Guiam a Arquitetura

### O sistema e orientado a `versions`, nao a `single outputs`

Isso muda tudo:

- banco
- UI
- filas
- scoring
- historico

### O sistema e orientado a `semantic operations`, nao so a prompts

Isso pede:

- JSONs internos
- regras de preserve/change
- zonas semanticas
- comparacao entre versoes

### O sistema e orientado a `creative consistency`

Nao basta gerar imagens bonitas. Precisamos de:

- repetibilidade
- controle
- coerencia entre variacoes
- refinamento incremental

---

## Roadmap Arquitetural Recomendado

### Fase 1: Consolidacao da fundacao atual

- estabilizar auth, queue, storage, previews, downloads
- introduzir docs de arquitetura
- organizar contratos compartilhados
- separar melhor dominio e infraestrutura

### Fase 2: Product core

- `projects`
- `thumbnail_versions`
- `reference_analyses`
- `generation_jobs`
- `ai_prompts`
- `style_presets`

### Fase 3: Reference Analyzer + Template Engine forte

- DNA visual estruturado
- templates recipe-based
- wizard guiado

### Fase 4: Semantic Editor

- preserve/change model
- versoes derivadas
- refinamentos localizados

### Fase 5: Finisher + Scoring + Suggestion Engine

- acabamentos profissionais
- scorecards
- sugestoes automaticas

---

## Recomendacao Final

O ThumbForge AI deve ser desenvolvido como uma plataforma criativa em tres camadas:

1. `Product Surface`
   Frontend premium, rapido e orientado a fluxo criativo.

2. `Creative Intelligence Layer`
   Reference Analyzer, Prompt Builder, Variant Generator, Semantic Editor, Scoring Engine.

3. `Execution Layer`
   Workers, storage, queue, AI providers, image processing, exports, observability.

Essa separacao cria um produto realmente diferenciado:

- mais controlavel que um simples gerador de imagem
- mais escalavel que uma logica toda no frontend
- mais reutilizavel que um sistema de prompts soltos
- mais profissional para creators que precisam consistencia visual

## Proximo Documento Recomendado

Depois deste overview, o proximo passo ideal e documentar:

1. modelagem de banco
2. contratos JSON internos
3. fluxos e APIs
4. backlog de implementacao por fases

