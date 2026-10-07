# Como testar o banco antes de usar

`teste_rls.sql` aplica o `schema.sql` num PostgreSQL comum (simulando o esquema `auth` do Supabase) e confere 18 regras de acesso: quem vê o quê, quem não pode gravar, bloqueio por conflito de interesses, cálculo da nota de risco e trilha de auditoria.

```bash
createdb teste_painel
psql -d teste_painel -v ON_ERROR_STOP=1 -q -f supabase/teste_rls.sql
dropdb teste_painel
```

Todas as linhas da tabela final devem sair com `OK`. **Rode apenas em banco vazio de teste, nunca no banco real**, porque o script cria papéis e dados fictícios.

Resultado da última execução (PostgreSQL 16, 7/10/2026): 18 de 18 `OK`.

O que o teste **não** cobre: Storage (anexos), login real do Supabase, verificação em duas etapas e desempenho. Teste isso no projeto Supabase real, com usuários de cada perfil, antes de entrar qualquer dado verdadeiro.
