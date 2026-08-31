# Integração WhatsApp para sugestões populares

Objetivo: além do formulário da LP, permitir que qualquer pessoa envie sugestões por WhatsApp (texto ou áudio), gravando na mesma base usada hoje.

## Como vai funcionar (visão do cidadão)

1. A pessoa manda mensagem para o número oficial do Juntos Paraná 399.
2. Se for áudio, o áudio é transcrito automaticamente.
3. A IA lê a mensagem e tenta identificar município, tema(s) e o conteúdo da sugestão.
4. O bot pergunta apenas o que ficou faltando (ex.: "Qual sua cidade?" ou "Qual seu nome?").
5. Ao completar, a sugestão é gravada e a pessoa recebe uma confirmação com agradecimento e link para ver o mapa.

Fluxo híbrido: texto livre + IA, com perguntas só para os campos ausentes. Sessão da conversa expira em 24h de inatividade.

## O que você precisa providenciar (pré-requisitos Meta)

Esta parte é feita por você no Meta, eu não consigo criar:

1. Conta no **Meta Business Manager** verificada.
2. App no **Meta for Developers** com o produto **WhatsApp** adicionado.
3. Um **número de telefone dedicado** (não pode estar em uso no app WhatsApp comum) registrado no WhatsApp Business Platform.
4. Anotar: `Phone Number ID`, `WhatsApp Business Account ID` e gerar um **token permanente** (System User Token com permissões `whatsapp_business_messaging` e `whatsapp_business_management`).
5. Depois que eu criar o webhook, você cola a URL dele no painel do app Meta e assina o evento `messages`.

Vou pedir esses valores como segredos: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`.

## O que eu vou construir

### Backend

- **Nova função `whatsapp-webhook`** (pública, `verify_jwt = false`):
  - `GET`: responde ao handshake de verificação da Meta (`hub.challenge`) validando o `WHATSAPP_VERIFY_TOKEN`.
  - `POST`: valida a assinatura `X-Hub-Signature-256` (HMAC com o app secret) e processa mensagens recebidas.
  - Trata tipos `text` e `audio`; ignora status callbacks e outros tipos com resposta amigável.
  - Áudio: baixa a mídia pela Graph API e transcreve reaproveitando a lógica já existente em `transcribe-audio`.
  - Extração via IA (Gemini pelo AI Gateway) devolvendo JSON estrito com `nome`, `municipio`, `tema_ids`, `descricao` e `faltando[]`, usando as listas reais de `municipios`, `eixos_tematicos` e `temas` do banco.
  - Perguntas de complemento apenas para os campos em `faltando`.
  - Grava em `sugestoes_populares` com `origem = 'whatsapp'`, `whatsapp` = telefone do remetente, e dispara `analyze-suggestion` / `classify-suggestion-eixo` como já acontece na LP.
  - Envia respostas via Graph API `POST /{phone_number_id}/messages`.

### Banco

- Nova tabela `whatsapp_sessions` (telefone, estado parcial em JSONB, `updated_at`), RLS fechada a admins + GRANTs para `service_role`; a função acessa com service role.
- Nova tabela `whatsapp_inbound_log` para deduplicação por `message_id` (a Meta reenvia webhooks).
- Coluna `origem` em `sugestoes_populares` (`'lp' | 'whatsapp'`), default `'lp'`, backfill dos registros atuais como `'lp'`.

### Painel

- Badge "WhatsApp" na listagem de sugestões (`AdminSugestoes.tsx`) e filtro por origem.
- Filtro de origem no Painel de Cruzamento, mantendo "Todas" como padrão.

## Riscos e limites

- Só é possível responder livremente dentro da janela de 24h após a mensagem do usuário — como o cidadão sempre inicia a conversa, isso atende o caso.
- Número de teste da Meta só envia para até 5 destinatários cadastrados; o número de produção exige a verificação do negócio.
- LGPD: o primeiro retorno do bot informa que a mensagem será usada como contribuição pública e traz o link da política de privacidade.

## Ordem de execução

1. Migração de banco (tabelas + coluna origem).
2. Segredos do WhatsApp.
3. Função `whatsapp-webhook` + envio de mensagens.
4. Extração por IA e transcrição de áudio.
5. Ajustes de badge/filtro no painel.
6. Você cadastra a URL do webhook no Meta e fazemos um teste ponta a ponta.
