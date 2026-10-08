# Portal de Assessorias — desenho técnico (rascunho)

Objetivo: cada prefeitura (cadastrada manualmente pelo admin) publica 1 conteúdo a cada 15 dias, gratuitamente, via chat. O agente redator reescreve no tom/policies do jornal e publica na página da cidade.

> **Atenção de escopo:** este repositório (`juntosparana399`) é a plataforma "Juntos Paraná 399 – Plano de Governo Colaborativo" e não contém nenhuma referência a `vozesparanaenses.com.br`. Antes de implementar, decidir se o portal vive aqui ou em projeto separado (ver "Decisão pendente").

## Reaproveitável do stack atual (Vite + React + shadcn + Supabase)
| Já existe | Uso no portal |
|---|---|
| `municipios` (399, `codigo_ibge`, `regiao`) | Âncora de cada assessoria e de cada página de cidade |
| `user_roles` + `has_role()` + `ProtectedRoute` | Novo papel `assessoria` |
| `user_municipios` | Vínculo usuário ↔ município (RLS por cidade) |
| Edge function `admin-create-user` | Cadastro manual pelo admin (já aceita `municipio_ids`) |
| `generate-comms-content` / `refine-comms-content` | Modelo para o agente redator (gateway de IA, limpeza de markdown) |
| `audit_logs` | Trilha de auditoria das publicações |
| `AdminMunicipios.tsx` | Base do painel de onboarding por cidade |

## Modelo de dados (novo)

```sql
-- papel novo
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assessoria';

-- 1 assessoria por município (pode haver mais de um usuário)
CREATE TABLE public.assessorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL UNIQUE REFERENCES public.municipios(id),
  nome_orgao text NOT NULL,                 -- "Secretaria de Comunicação de X"
  responsavel_nome text NOT NULL,
  responsavel_cargo text,
  email text NOT NULL,
  whatsapp text,
  vinculo text CHECK (vinculo IN ('servidor','terceirizado')),
  status text NOT NULL DEFAULT 'convidada'  -- convidada|ativa|suspensa
    CHECK (status IN ('convidada','ativa','suspensa')),
  termos_aceitos_em timestamptz,
  termos_versao text,
  lgpd_aceite_em timestamptz,
  plano text NOT NULL DEFAULT 'gratuito',
  intervalo_dias int NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.publicacoes_assessoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessoria_id uuid NOT NULL REFERENCES public.assessorias(id),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id),
  autor_id uuid NOT NULL REFERENCES auth.users(id),
  -- entrada original (imutável)
  texto_original text NOT NULL,
  fotos jsonb NOT NULL DEFAULT '[]',        -- [{path, legenda, credito}]
  -- fatos extraídos e confirmados pela assessoria
  fatos_extraidos jsonb NOT NULL DEFAULT '[]', -- [{rotulo, valor}]
  fatos_confirmados_em timestamptz,
  -- saída do agente
  titulo text, subtitulo text, corpo text, slug text,
  rotulo text NOT NULL DEFAULT 'Conteúdo da Prefeitura',
  -- políticas
  policy_resultado jsonb,                   -- {aprovado, flags:[{regra,trecho}]}
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aguardando_fatos','em_revisao','publicada','rejeitada','despublicada')),
  revisado_por uuid REFERENCES auth.users(id),
  publicada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, slug)
);

-- cota: 1 publicação publicada/em revisão a cada N dias por assessoria
CREATE OR REPLACE FUNCTION public.proxima_publicacao_em(_assessoria uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(max(p.created_at) + make_interval(days => a.intervalo_dias), now())
  FROM assessorias a
  LEFT JOIN publicacoes_assessoria p
    ON p.assessoria_id = a.id AND p.status IN ('em_revisao','publicada')
  WHERE a.id = _assessoria
  GROUP BY a.intervalo_dias;
$$;
```

RLS: assessoria lê/escreve só as linhas do próprio `municipio_id` (via `user_municipios`); leitura pública apenas de `status = 'publicada'`; admin/curador gerenciam tudo. A cota é aplicada **no servidor** (edge function), não só na UI.

Storage: bucket `assessoria-fotos` (escrita só da assessoria na pasta do próprio município; leitura pública após publicação).

## Fluxo (chat)
1. **Login** (conta criada pelo admin) → chat bloqueado se `now() < proxima_publicacao_em` (mostra a data).
2. Assessoria cola o texto e sobe a(s) foto(s) (+ legenda e crédito, obrigatórios).
3. Edge function `assessoria-extrair-fatos`: IA extrai datas, valores, nomes, cargos, endereços → assessoria **confirma/edita** (marca `fatos_confirmados_em`).
4. Edge function `assessoria-redigir`: reescreve no tom do jornal usando os fatos confirmados como fonte de verdade; proíbe inventar dado fora da lista.
5. Edge function `assessoria-policy-check`: aplica as regras (abaixo). Resultado em `policy_resultado`.
   - sem flags → `publicada` (automático)
   - com flags → `em_revisao` (fila do admin)
6. Publicada: URL `/{regiao}/{municipio-slug}/{slug}` + kit de compartilhamento (card WhatsApp/Instagram, texto curto) devolvido no chat.

## Políticas editoriais (checagem automática)
- Impessoalidade: sem promoção pessoal de agente político (nome/foto do gestor como protagonista, slogans, "gestão X").
- Período eleitoral: bloquear/segurar para revisão qualquer publicação em datas de vedação de publicidade institucional e menções a candidatos/partidos.
- Fidelidade: todo número/data/nome do texto final deve existir na lista de fatos confirmados.
- Sem dados pessoais sensíveis nem imagens de menores identificáveis sem autorização.
- Rótulo fixo visível: "Conteúdo da Prefeitura de X, com edição de <jornal>".
- Tom/estilo do jornal definido num prompt versionado (tabela de config, como `ai_agent_config`).

## Painel admin (`/admin/assessorias`)
- Grade das 399 cidades: não cadastrada / convidada / ativa / suspensa, filtro por região, última publicação, próxima liberação.
- Cadastro/edição da assessoria (reaproveita `admin-create-user` com papel `assessoria` + `municipio_ids`).
- Fila de revisão: original × reescrito lado a lado, fatos, flags da policy, ações aprovar / editar / rejeitar.
- Despublicar com motivo; log em `audit_logs`.

## SEO (liga com a estratégia das 399 páginas)
- Página de cidade lista as publicações com `NewsArticle` (schema.org), `Place` na cidade, canonical por URL e sitemap por região.
- Fotos com legenda/crédito; o agente acrescenta um bloco de contexto com dados públicos da cidade (valor agregado, evita conteúdo raso).

## Decisão pendente
1. **Onde vive:** este repo é a plataforma do plano de governo (vinculada a pré-campanha). Misturar nela um veículo que publica conteúdo de prefeituras mistura jornalismo/publicidade institucional com campanha política — recomendável **projeto separado** para `vozesparanaenses.com.br`, reaproveitando o padrão (Supabase + roles + municipios).
2. **Confirmação:** publicação 100% automática desde o início, ou revisão humana nas primeiras N publicações de cada cidade?
3. **Calendário eleitoral:** quais datas de vedação o filtro deve bloquear.
