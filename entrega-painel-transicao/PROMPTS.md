# Prompts prontos para o Claude

Cole um por vez. Todos assumem que o Claude já leu o `CLAUDE.md`.

## 1. Primeiro contato
Leia o CLAUDE.md, a docs/ESPECIFICACAO.md e o painel-transicao.html. Rode o teste em tests/fluxos.test.cjs. Explique em português simples o que o protótipo faz hoje e o que falta. Depois proponha os três próximos passos, sem alterar nada ainda.

## 2. Novas telas do protótipo
- **Plano dos 100 dias:** Crie uma aba "Plano dos 100 dias" com a tabela medida, secretaria, tipo (decreto, lei, contrato, programa), meta, responsável e prazo (15/1, 15/2 ou 15/4). Ligue ao painel geral com um indicador. Rode os testes.
- **Atos do dia 1:** Crie uma aba "Atos do dia 1" com a lista de decretos, nomeações e exonerações para 6/1/2027, com status (minuta, revisão jurídica, pronto para assinatura).
- **Pontos críticos por secretaria:** Em cada grupo, mostre o checklist de pontos críticos do kit (riscos fiscais, contratuais, de pessoas e serviços, de informação e políticos). Marcar "confirmado" cria um risco no mapa, já com o ponto preenchido.
- **Relatório consolidado:** Crie uma aba que monta o rascunho do relatório consolidado nas 8 seções do kit (sumário executivo, situação fiscal, riscos críticos, diagnóstico por área, estrutura, LOA 2027, atos do dia 1, Plano dos 100 dias), a partir dos dados das outras abas. Máximo de 30 páginas.
- **Agenda e prazos do calendário:** Mostre a linha do tempo das fases com os prazos-limite do kit e destaque o que vence nos próximos 7 dias.

## 3. Melhorias nas telas existentes
- No Gerador de ofícios, permita salvar modelos próprios e duplicar um ofício já registrado.
- No Painel geral, filtre a matriz por grupo, bloco e situação, e acrescente um botão para exportar a matriz em planilha.
- Na aba Equipe, ligue as declarações de conflito aprovadas ao controle de acesso (bloqueios por grupo).
- Acrescente uma busca global (ofícios, riscos, autoridades).

## 4. Passagem para a versão real
- Leia supabase/schema.sql e liste problemas e riscos de segurança antes de aplicarmos. Não aplique nada ainda.
- Crie o projeto web (React + TypeScript + Vite) em uma pasta nova, reaproveitando o visual e as regras do protótipo, com login do Supabase e uma aba por vez. Comece por Ofícios e prazos.
- Implemente a exportação do ofício em PDF e Word, com cabeçalho e assinatura configuráveis.
- Escreva testes automáticos das regras de acesso (um usuário de cada perfil tenta ver e alterar dados de outro grupo).

## 5. Revisão e qualidade
- Revise o painel-transicao.html procurando bugs de fluxo, textos sem acento, problemas de acessibilidade e telas que quebram no celular. Liste antes de corrigir.
- Faça uma revisão de segurança e de LGPD do que vamos construir, indicando o que precisa de parecer jurídico.

## 6. Quando o Claude errar
Você inventou isso. Aponte a fonte ou troque por "A definir" e liste o que precisa ser confirmado por um humano.
