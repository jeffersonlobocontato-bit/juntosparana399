# Integração WhatsApp para sugestões populares (webhook do fornecedor)

## Como funciona

O fornecedor (BSP/provedor de WhatsApp) cuida de toda a conversa com o cidadão: boas-vindas, perguntas, transcrição de áudio e extração dos dados. Quando a sugestão está completa, ele chama um webhook nosso com o JSON pronto. A gente valida o token, grava na base de sugestões e dispara a mesma classificação semântica que já usamos na LP.

```
[Cidadão] → WhatsApp → [Fornecedor] → webhook + token → [Edge Function] → sugestoes_populares
                                                                    ↓
                                              analyze-suggestion + classify-suggestion-eixo
```

Nada de bot, sessão, transcrição ou envio de mensagens do nosso lado — o fornecedor é a porta de entrada.

## O que eu vou construir

### 1. Banco (migração)

- Coluna `origem` em `sugestoes_populares` (`text`, default `'lp'`), com backfill dos registros atuais como `'lp'`.
- Sem novas tabelas — o fornecedor não precisa de sessão nem log do nosso lado.

### 2. Segredos

- `WHATSAPP_WEBHOOK_TOKEN` — token secreto que nós geramos e entregamos ao fornecedor. Ele envia no header `Authorization: Bearer <token>` a cada chamada. A edge function rejeita qualquer chamada sem o token válido.

### 3. Edge Function `whatsapp-suggestion-webhook`

- `verify_jwt = false` (chamada externa, sem usuário Supabase).
- `OPTIONS` → CORS.
- `POST` → valida `Authorization: Bearer <token>` contra `WHATSAPP_WEBHOOK_TOKEN`; rejeita com 401 se divergir.
- Valida o corpo com Zod:
  ```json
  {
    "nome": "string | null",
    "municipio": "string (obrigatório)",
    "descricao": "string (obrigatório)",
    "telefone": "string | null",
    "email": "string | null",
    "tema_ids": "string[] (opcional)",
    "tema_nomes": "string[] (opcional — fallback se não mandar IDs)"
  }
  ```
- Resolve `municipio` (texto) → `municipios.id` por nome; se não achar, grava o texto mesmo assim.
- Se `tema_ids` não vier, tenta casar `tema_nomes` contra a tabela `temas`; se nada casar, deixa `tema_ids = null` e a IA classifica depois.
- Grava em `sugestoes_populares` com `origem = 'whatsapp'`, `whatsapp = telefone`, `publico = true`.
- Dispara em fire-and-forget `analyze-suggestion` e `classify-suggestion-eixo` (mesmo fluxo da LP).
- Retorna `{ ok: true, sugestao_id }` para o fornecedor.
- Idempotência: se o fornecedor enviar um `external_id` (opcional), a função verifica se já existe sugestão com esse `metadata.external_id` e retorna `200` sem duplicar.

### 4. Painel

- Badge "WhatsApp" na tabela de `AdminSugestoes.tsx` (ao lado do nome, quando `origem === 'whatsapp'`).
- Filtro de origem no seletor de eixos: `Todas | LP | WhatsApp`.
- Filtro de origem também no Painel de Cruzamento (`AdminCruzamentoSugestoes.tsx`), mantendo "Todas" como padrão.
- Export CSV inclui coluna "Origem".

### 5. Entrega ao fornecedor

Depois de pronto, eu forneço ao fornecedor:
- URL do webhook: `https://ckgmdsdoywkncduigdkk.supabase.co/functions/v1/whatsapp-suggestion-webhook`
- Header: `Authorization: Bearer <token>`
- Método: `POST`, `Content-Type: application/json`
- Esquema do corpo (o JSON acima)

## Ordem de execução

1. Migração (coluna `origem` + backfill).
2. Gerar `WHATSAPP_WEBHOOK_TOKEN` via `add_secret`.
3. Criar e publicar a edge function `whatsapp-suggestion-webhook`.
4. Badge + filtro no `AdminSugestoes.tsx` e no `AdminCruzamentoSugestoes.tsx`.
5. Testar o webhook com um payload de exemplo.
6. Entregar URL + token + esquema ao fornecedor.
