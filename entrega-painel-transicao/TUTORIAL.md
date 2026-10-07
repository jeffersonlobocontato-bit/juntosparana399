# Tutorial: instalar e continuar o Painel da Transição

Este pacote traz o protótipo do Painel da Transição, o contexto do projeto e tudo que a próxima pessoa precisa para continuar as melhorias com o próprio Claude. Não é preciso saber programar para o Caminho A. O Caminho B é para quem quer evoluir o sistema de verdade.

## O que veio no pacote

| Arquivo | Para que serve |
|---|---|
| `painel-transicao.html` | O protótipo. Abre com duplo clique no navegador. |
| `CLAUDE.md` | Contexto e regras do projeto. O Claude lê este arquivo primeiro. |
| `PROMPTS.md` | Textos prontos para colar no Claude. |
| `docs/ESPECIFICACAO.md` | Resumo do Kit de Transição, fluxos, perfis e regras de negócio. |
| `docs/AUTORIDADES.md` | Titulares das secretarias, com fontes e o aviso de que não estão conferidos. |
| `supabase/schema.sql` | Rascunho do banco de dados para a versão real. Testado só num PostgreSQL local (ver `supabase/TESTE.md`). |
| `supabase/teste_rls.sql` | Teste das regras de acesso do banco (quem vê e altera o quê). |
| `package.json` | Atalhos para servir a página e rodar os testes. |
| `tests/fluxos.test.cjs` | Teste automático das ligações entre as abas. |

**Importante:** o documento original (Kit de Transição de Governo Estadual, 14 páginas, de 30/9/2026) não vai dentro do pacote. Peça o PDF à coordenação e anexe-o ao Claude quando for pedir algo que dependa de detalhes do kit.

## Antes de começar
1. Uma conta no Claude (claude.ai). Para o Caminho B, um plano que inclua o Claude Code.
2. Um navegador moderno (Chrome, Edge ou Firefox).
3. Este pacote descompactado numa pasta, por exemplo `Documentos/painel-transicao`.

---

## Caminho A: ver e melhorar pelo Claude no navegador (sem instalar nada)

**1. Veja o protótipo.** Dê dois cliques em `painel-transicao.html`. Ele abre no navegador. Navegue pelas abas. Os dados são de exemplo e somem ao recarregar.

**2. Crie um projeto no Claude.**
1. Entre em claude.ai e crie um **Projeto** novo chamado "Painel da Transição".
2. Em **Conhecimento do projeto** (project knowledge), anexe: `CLAUDE.md`, `docs/ESPECIFICACAO.md`, `docs/AUTORIDADES.md` e o PDF do kit.
3. Em **Instruções do projeto**, cole: *"Siga o CLAUDE.md. Responda em português do Brasil. Não invente fatos jurídicos nem nomes."*

**3. Peça melhorias.** Em uma conversa dentro do projeto, anexe `painel-transicao.html` e escreva o que quer mudar. Exemplos:
- "Acrescente a aba do Plano dos 100 dias, com medida, secretaria, tipo, meta, responsável e prazo."
- "Troque o nome do bloco 4 para 'Obras e investimentos'."

**4. Receba o arquivo novo.** O Claude devolve o HTML atualizado (como arquivo ou como artefato). Salve por cima do `painel-transicao.html`, **guardando uma cópia da versão anterior** (por exemplo `painel-transicao-v1.html`).

**5. Publicar para outras pessoas verem.** Peça ao Claude: *"Publique este HTML como artefato."* O link é privado, e só abre para quem você compartilhar. Se sua conta não tiver artefatos, abra o arquivo por um servidor local (item 6 do Caminho B) ou mande o HTML por e-mail.

**Limites do Caminho A:** é bom para desenho, textos e telas. Para banco de dados, login e anexos reais, siga o Caminho B.

---

## Caminho B: evoluir o sistema de verdade com o Claude Code

O Claude Code trabalha direto nos arquivos da pasta, roda os testes e guarda o histórico.

**1. Instale o Claude Code.** Siga o guia oficial em https://code.claude.com/docs (há versão para terminal, aplicativo de computador, navegador e extensões de editor). Uma forma comum é `npm install -g @anthropic-ai/claude-code`, com Node.js 18 ou mais novo instalado. Em caso de dúvida, o guia oficial vale mais do que este tutorial.

**2. Abra a pasta do projeto.** No terminal:
```bash
cd caminho/para/entrega-painel-transicao
git init            # opcional, mas recomendado: guarda o histórico
claude
```

**3. Cole o primeiro texto** (também está em `PROMPTS.md`):
> Leia o CLAUDE.md, a docs/ESPECIFICACAO.md e o painel-transicao.html. Rode o teste em tests/fluxos.test.cjs e me diga em português simples o que o protótipo faz hoje e o que falta. Depois proponha os três próximos passos, sem alterar nada ainda.

**4. Peça uma melhoria por vez.** Peça algo pequeno, peça para o Claude rodar o teste e confira o resultado abrindo o HTML. Exemplo:
> Acrescente a aba "Plano dos 100 dias". Mantenha o estilo das outras abas, ligue ao painel geral e rode os testes.

**5. Rode os testes.** Uma vez só, para instalar:
```bash
npm install
npx playwright install chromium
```
Depois, a cada mudança:
```bash
npm test
```
O teste abre o protótipo, gera e registra um ofício, anexa arquivos, cria risco e autoridade, e confere se tudo aparece nos outros lugares. Se algo quebrar, ele mostra qual verificação falhou.

**6. Ver no navegador com servidor local.**
```bash
python3 -m http.server 8000
```
Abra http://localhost:8000/painel-transicao.html.

**7. Guarde o histórico.** Peça ao Claude: "faça um commit com uma mensagem clara". Se quiser guardar no GitHub, **crie um repositório privado e separado do site de campanha**.

---

## Passar para a versão real (banco de dados, login, anexos)

Fazer só depois de a coordenação aprovar o desenho do protótipo.

1. **Crie um projeto novo em supabase.com**, separado do projeto do site de campanha (decisão tomada: ambiente próprio). Escolha uma região no Brasil, se estiver disponível.
2. **Revise `supabase/schema.sql`** com alguém que conheça bancos de dados. É um rascunho. Ele traz tabelas, regras de acesso por grupo e a nota de risco calculada. Aplique no SQL Editor do Supabase ou com a CLI. Depois, **refaça os testes de acesso com usuários reais de cada perfil no projeto Supabase**, porque o teste local (`supabase/TESTE.md`) simula o login.
3. **Crie um bucket privado** `anexos` no Storage, para os documentos de ofícios e relatórios.
4. **Ligue o login** com e-mail e verificação em duas etapas. Só quem a Administração (Alcione Gomes) aprovar e que tiver assinado o termo acessa.
5. **Peça ao Claude para trocar os dados em memória pelas chamadas ao banco**, uma aba por vez, começando por Ofícios e prazos. Peça também a exportação do ofício em PDF e Word.
6. **Subdomínio:** publique em um subdomínio do Juntos Paraná 399. Quem controla o DNS cria o registro. A publicação pode ser na Vercel, Netlify ou Cloudflare Pages.
7. **Segurança, antes de entrar qualquer dado real:**
   - nunca guardar chaves ou `.env` no repositório;
   - ativar as regras de acesso (RLS) em todas as tabelas e testar com usuários de perfis diferentes;
   - registrar quem viu, baixou e alterou cada documento (trilha de auditoria);
   - revisão pela PGE ou pelo jurídico sobre sigilo, LGPD e Lei de Acesso à Informação.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| A página abre sem as fontes bonitas | É só o Google Fonts bloqueado. O sistema usa a fonte padrão e funciona igual. |
| Os dados sumiram | É o esperado no protótipo. Só a versão com banco guarda os dados. |
| O teste diz "browserType.launch" | Falta `npx playwright install chromium`. |
| O botão de fundo escuro não lembra a escolha | Navegador com armazenamento bloqueado. O botão funciona, só não grava. |
| O Claude "inventou" um nome ou artigo | Peça para ele indicar a fonte. Se não houver, é para ficar `[entre colchetes]` ou "A definir". |

## Cuidados com informação

- O protótipo não deve receber dados reais de pessoas ou documentos sigilosos. Use dados de exemplo.
- A lista de titulares em `docs/AUTORIDADES.md` veio de notícias e **precisa de conferência oficial** antes de qualquer ofício sair.
- As regras de conflito de interesses e a autoria do ofício (Governador eleito ou coordenação) são **sugestões**. Peça parecer jurídico antes de adotá-las.
