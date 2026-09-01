# Painel de Integração WhatsApp (/admin/whatsapp) — token visível e copiável

Replicar o padrão usado na plataforma do Mato Grosso: um módulo admin onde o endpoint de ingestão e o token de segurança ficam visíveis na tela para copiar e enviar ao fornecedor, com botão de regeneração.

Hoje o token (`WHATSAPP_WEBHOOK_TOKEN`) vive apenas no cofre do backend e nunca pode ser exibido — por isso não dá para copiar. A solução é espelhar o MT: guardar o token em uma tabela do banco com leitura restrita a admins, para que o painel possa exibi-lo e a Edge Function valide contra ele.

## 1. Banco de dados (migração)

- Nova tabela `public.whatsapp_ingest_config` (linha única): `id`, `token` (texto), `created_at`, `updated_at`.
- GRANTs: `SELECT, UPDATE` para `authenticated`, `ALL` para `service_role`; sem acesso `anon`.
- RLS habilitada: apenas `admin`/`admin_master` leem e atualizam (via `has_role`).
- Função RPC `regenerate_whatsapp_token()` (SECURITY DEFINER, admin-only): gera novo token forte (ex.: 64 hex via `gen_random_bytes`), atualiza a linha e retorna o novo valor.
- Coluna `external_id` (texto) em `sugestoes_populares` para idempotência real por mensagem do fornecedor.
- Seed inicial: migra o comportamento atual gerando um primeiro token na tabela (o env `WHATSAPP_WEBHOOK_TOKEN` permanece como fallback temporário e pode ser removido depois).

## 2. Edge Function `whatsapp-suggestion-webhook` (alinhamento ao contrato do MT)

- Aceitar autenticação pelo header `X-Ingest-Token` (novo padrão) mantendo `Authorization: Bearer` por compatibilidade; validar contra o token da tabela `whatsapp_ingest_config` (fallback ao env se a tabela estiver vazia).
- Aceitar campo `sugestao` como alias de `descricao` (contrato do fornecedor usa `sugestao`).
- Idempotência por `external_id`: se já existir sugestão com o mesmo `external_id`, responder **409** (`{ error: "already_processed" }`) em vez de reprocessar; manter a deduplicação atual por telefone+texto como segunda camada.
- Respostas documentadas: 201 criado, 409 duplicado, 400 validação, 401 token inválido, 405 método.
- Somente POST.

## 3. Nova página `/admin/whatsapp` (`src/pages/AdminWhatsApp.tsx`)

Cards na mesma identidade visual do admin:
- **Endpoint de ingestão** — URL completa da Edge Function com botão Copiar.
- **Token de segurança** — valor mascarado por padrão, botões Revelar, Copiar e **Regenerar** (chama a RPC e confirma antes, avisando que o fornecedor precisa atualizar).
- **Contrato de payload** — tabela de campos obrigatórios (`nome`, `telefone`, `municipio`, `sugestao`, `external_id`) e opcionais (`email`, `tema_ids`/`tema_nomes`), adaptada aos 399 municípios do Paraná.
- **Exemplo de requisição** — bloco JSON pronto + exemplo cURL com botão copiar.
- **Códigos de erro** — 401 token, 409 já processada, 400 validação.
- **Boas práticas** — enviar apenas o resultado final da conversa; reenvios usam o mesmo `external_id`.

## 4. Rota e menu

- Rota `/admin/whatsapp` em `src/App.tsx` com `ProtectedRoute` restrito a `admin`/`admin_master`.
- Novo card "Integração WhatsApp" no grid de `src/pages/Admin.tsx` (mesmo padrão dos demais cards).

## 5. Guia do fornecedor

- Regenerar o DOCX do guia já existente (`guia_integracao_webhook_whatsapp_fornecedor`) atualizando o header para `X-Ingest-Token`, o campo `sugestao` e o código 409, mantendo o token fora do documento (você cola manualmente antes de enviar).

## Verificação

- Build sem erros; teste real do endpoint com o token do banco (201), token errado (401), `external_id` repetido (409) e payload com `sugestao`.
- Conferir no painel que revelar/copiar/regenerar funcionam e que após regenerar o token antigo passa a falhar.
