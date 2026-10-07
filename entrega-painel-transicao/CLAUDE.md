# Painel da Transição – contexto para o Claude

Leia este arquivo inteiro antes de qualquer alteração. Ele resume o projeto, as decisões já tomadas e as regras de trabalho.

## O que é
Plataforma de gestão da transição do governo do Paraná, entre o governo atual (Ratinho Junior / Darci Piana) e o governo eleito (Sergio Moro / Edson Vasconcelos). Moro foi eleito no 1º turno em 4/10/2026 (fonte: TSE). A posse é em **6 de janeiro de 2027** e o dia 100 do mandato é **15 de abril de 2027**.

Ela organiza o trabalho descrito no **Kit de Transição de Governo Estadual** (documento de 14 páginas, resumido em `docs/ESPECIFICACAO.md`): grupos temáticos por secretaria, ofícios com prazo, relatório padrão em 8 blocos, mapa de riscos, Plano dos 100 dias e termo de confidencialidade.

## Estado atual
- **`painel-transicao.html`** é um **protótipo clicável em um único arquivo** (HTML + CSS + JavaScript puro, sem bibliotecas e sem build). Abre com duplo clique no navegador.
- **Todos os dados são de exemplo e ficam só na memória do navegador.** Recarregar a página apaga tudo. Anexos guardam só o nome do arquivo.
- Nada foi ligado a banco, login ou servidor. O rascunho do banco está em `supabase/schema.sql`. Ele passou em 18 verificações de acesso num PostgreSQL local (`supabase/teste_rls.sql`, ver `supabase/TESTE.md`), mas **não foi testado no Supabase real nem revisado por especialista em segurança**.

### O que o protótipo já faz (testado em navegador, ver `tests/`)
- **Painel geral:** contagem até a posse, fases, indicadores e matriz 11 grupos × 8 blocos (semáforo), com mudança de situação por clique.
- **Ofícios e prazos:** registro com prazo de 5 dias úteis, "Ver ofício" (texto guardado), anexar resposta.
- **Gerador de ofícios:** 14 modelos baseados nos questionários do kit, destinatário por secretaria, itens marcáveis, texto editável, assinatura "Sergio Moro, Governador eleito" ou coordenação.
- **Autoridades:** base editável dos titulares das secretarias (não conferida).
- **Relatório da secretaria:** 8 blocos com tabelas do kit, anexos, linhas extras e situação por bloco.
- **Mapa de riscos:** nota = probabilidade (1–3) × impacto (1–3). 6 a 9 crítico, 3 a 4 alto, 1 a 2 moderado.
- **Conflito de interesses:** declaração com 7 perguntas e resultado (liberado, com restrições, aguardando parecer).
- **Equipe e acessos** e botão de **fundo escuro** com paleta azul.

### Ligações entre abas (mantenha)
- Registrar ofício → aparece em *Ofícios e prazos*, soma nos indicadores, marca os blocos do modelo como "Solicitado" na matriz.
- Registrar resposta → blocos do modelo passam a "Entregue".
- Anexar documento num bloco do relatório → bloco passa a "Parcial" (se estava abaixo).
- Novo risco → entra no mapa e nos riscos críticos do painel (nota ≥ 6).
- Nova autoridade → aparece na aba Autoridades e no seletor do gerador.

## Decisões já tomadas (não reabra sem o usuário pedir)
1. **Administradora da plataforma e quem aprova acessos: Alcione Gomes.**
2. **O governo atual NÃO tem acesso à plataforma.** Ofícios saem pelos canais oficiais; a equipe registra o protocolo, o prazo e a resposta recebida.
3. **Hospedagem:** subdomínio do Juntos Paraná 399, mas em **ambiente separado** do site de campanha. Banco de dados próprio (projeto Supabase novo). **Nunca** misturar com o repositório ou o banco da campanha.
4. **Perfis:** administração, coordenação geral, secretaria-executiva, núcleos, coordenador de grupo, técnico de grupo, governador eleito (somente leitura).
5. **Conflito de interesses:** declaração antes do primeiro acesso. Vínculo com fornecedor ou parente em cargo de direção bloqueia a área. Servidor do governo atual entra em modo técnico, sem acesso aos dossiês do próprio órgão. Doação de campanha é só informativa.
6. **Visual:** tema claro por padrão e botão de fundo escuro com a paleta azul (`#061B2E`, `#0C2D4F`, `#033A68`, `#33B7EF`, `#B0CCE2`). As cores de situação (verde, âmbar, vermelho) ficam fora da paleta de propósito.

## Regras de trabalho
- **Idioma:** português do Brasil em toda a interface, textos e documentação.
- **Mantenha o arquivo único e sem dependências** enquanto for protótipo. A fonte vem do Google Fonts, com alternativa do sistema.
- **Não invente fatos jurídicos, nomes ou números.** Artigos do decreto aparecem entre colchetes (`art. [4º]`) porque seguem a minuta do kit. Toda regra de conflito de interesses é sugestão e precisa de parecer da PGE ou do jurídico.
- **Autoridades:** nada está "Conferido". Só marque como conferido quando o usuário confirmar no Diário Oficial.
- **Nunca coloque dados reais de pessoas no protótipo, nem senhas, chaves ou `.env` em arquivos versionados.**
- Acessibilidade: todo controle com rótulo, foco visível, cor nunca como único sinal (as células da matriz têm símbolo e texto).
- Depois de qualquer mudança, **rode os testes** (`tests/`) e confira as ligações entre abas.

## Como rodar e testar
```bash
# ver o protótipo
python3 -m http.server 8000   # e abra http://localhost:8000/painel-transicao.html

# testes dos fluxos (precisa de Node 18+)
npm install && npx playwright install chromium
npm test        # roda tests/fluxos.test.cjs (18 verificações)
```

## Próximos passos sugeridos (ordem)
1. Revisar o protótipo com a coordenação (campos, nomes de bloco, fluxos).
2. Conferir os titulares em `docs/AUTORIDADES.md` no Diário Oficial.
3. Criar o projeto Supabase separado e aplicar `supabase/schema.sql` (revisar antes).
4. Trocar os dados em memória por leitura e escrita no banco, com login, verificação em duas etapas e permissões por grupo.
5. Storage privado para anexos, trilha de auditoria, exportação do ofício em PDF e Word com timbre.
6. Módulos que faltam: riscos por ponto crítico com checklist por secretaria, Plano dos 100 dias, atos do dia 1, relatório consolidado automático (até 30 páginas).

Mais prompts prontos em `PROMPTS.md`.
