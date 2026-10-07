-- Teste das regras de acesso. Roda em um PostgreSQL comum (simula o esquema `auth` do Supabase).
-- Uso:  psql -v ON_ERROR_STOP=1 -f teste_rls.sql  (em um banco VAZIO de teste, nunca no real)
\set ON_ERROR_STOP on
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
\ir schema.sql

-- usuários de teste
insert into auth.users (id) values
 ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),
 ('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000d'),
 ('00000000-0000-0000-0000-00000000000e'),('00000000-0000-0000-0000-00000000000f');
insert into membros (id, nome, perfil, grupo_id, aprovado, termo_assinado_em) values
 ('00000000-0000-0000-0000-00000000000a','Admin','administracao',null,true,now()),
 ('00000000-0000-0000-0000-00000000000b','Tecnico Saude','tecnico_grupo',3,true,now()),
 ('00000000-0000-0000-0000-00000000000c','Tecnico Educacao','tecnico_grupo',4,true,now()),
 ('00000000-0000-0000-0000-00000000000d','Tecnico Saude bloqueado','tecnico_grupo',3,true,now()),
 ('00000000-0000-0000-0000-00000000000e','Sem aprovacao','tecnico_grupo',3,false,null),
 ('00000000-0000-0000-0000-00000000000f','Governador','governador_eleito',null,true,now());
insert into membro_bloqueios values ('00000000-0000-0000-0000-00000000000d',3,'sócio de fornecedor');
insert into oficios (numero,grupo_id,assunto,enviado_em,prazo_em,criado_por) values
 ('001/2026',3,'Saúde','2026-10-05','2026-10-12','00000000-0000-0000-0000-00000000000a'),
 ('002/2026',4,'Educação','2026-10-05','2026-10-12','00000000-0000-0000-0000-00000000000a');

create temp table resultado (caso text, esperado text, obtido text);
grant all on resultado to authenticated;
create or replace function pg_temp.como(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
\set D '00000000-0000-0000-0000-00000000000d'
\set E '00000000-0000-0000-0000-00000000000e'
\set F '00000000-0000-0000-0000-00000000000f'

-- 1. técnico da Saúde vê só o ofício da Saúde
set role authenticated; select set_config('request.jwt.claim.sub', :'B', false) \gset
insert into resultado select 'tecnico saude ve so saude', '1', count(*)::text from oficios;
insert into resultado select 'tecnico saude ve o de saude', '001/2026', string_agg(numero,',') from oficios;
-- 2. técnico da Educação vê só o da Educação
select set_config('request.jwt.claim.sub', :'C', false) \gset
insert into resultado select 'tecnico educacao ve so educacao', '002/2026', string_agg(numero,',') from oficios;
-- 3. bloqueado por conflito não vê nada da Saúde
select set_config('request.jwt.claim.sub', :'D', false) \gset
insert into resultado select 'bloqueado nao ve saude', '0', count(*)::text from oficios;
-- 4. sem aprovação não vê nada
select set_config('request.jwt.claim.sub', :'E', false) \gset
insert into resultado select 'nao aprovado nao ve nada', '0', count(*)::text from oficios;
-- 5. administração vê tudo
select set_config('request.jwt.claim.sub', :'A', false) \gset
insert into resultado select 'admin ve tudo', '2', count(*)::text from oficios;
-- 6. governador eleito não vê ofícios
select set_config('request.jwt.claim.sub', :'F', false) \gset
insert into resultado select 'governador nao ve oficios', '0', count(*)::text from oficios;
reset role;

-- 7. técnico da Saúde NÃO consegue criar ofício na Educação (deve falhar)
set role authenticated; select set_config('request.jwt.claim.sub', :'B', false) \gset
do $$ begin
  begin
    insert into oficios (numero,grupo_id,assunto,enviado_em,prazo_em,criado_por)
    values ('X/2026',4,'invasao','2026-10-05','2026-10-12','00000000-0000-0000-0000-00000000000b');
    insert into resultado values ('tecnico nao cria na educacao','bloqueado','PERMITIU');
  exception when others then
    insert into resultado values ('tecnico nao cria na educacao','bloqueado','bloqueado');
  end;
end $$;
-- 8. técnico cria na própria área
insert into oficios (numero,grupo_id,assunto,enviado_em,prazo_em,criado_por)
values ('003/2026',3,'ok','2026-10-05','2026-10-12','00000000-0000-0000-0000-00000000000b');
insert into resultado select 'tecnico cria na propria area','2',count(*)::text from oficios;
-- 9. técnico NÃO registra risco
do $$ begin
  begin
    insert into riscos (grupo_id,ponto_critico,descricao,probabilidade,impacto,criado_por)
    values (3,'x','y',3,3,'00000000-0000-0000-0000-00000000000b');
    insert into resultado values ('tecnico nao registra risco','bloqueado','PERMITIU');
  exception when others then
    insert into resultado values ('tecnico nao registra risco','bloqueado','bloqueado');
  end;
end $$;
-- 10. técnico não se promove (update em membros deve afetar 0 linhas)
with u as (update membros set perfil='administracao' where id='00000000-0000-0000-0000-00000000000b' returning 1)
insert into resultado select 'tecnico nao se promove','0',count(*)::text from u;
-- 11. técnico não lê a auditoria
insert into resultado select 'tecnico nao le auditoria','0',count(*)::text from auditoria;
-- 12. ninguém grava direto na auditoria
do $$ begin
  begin
    insert into auditoria (acao,tabela) values ('x','y');
    insert into resultado values ('ninguem grava na auditoria','bloqueado','PERMITIU');
  exception when others then
    insert into resultado values ('ninguem grava na auditoria','bloqueado','bloqueado');
  end;
end $$;
reset role;

-- 13. administração cria risco e a nota/classificação são calculadas
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false) \gset
insert into riscos (grupo_id,ponto_critico,descricao,probabilidade,impacto,criado_por)
values (3,'Contratos essenciais vencendo','Medicamentos',3,3,:'A'),
       (4,'Início do ano letivo','Transporte',2,2,:'A'),
       (0,'Restos a pagar elevados','Fluxo',1,2,:'A');
insert into resultado select 'classificacao calculada','critico,alto,moderado',
  string_agg(classificacao,',' order by nota desc) from riscos;
-- 14. a trilha de auditoria registrou as ações
insert into resultado select 'auditoria registrou','sim', case when count(*)>=5 then 'sim' else 'nao' end from auditoria;
reset role;

-- 15. governador eleito lê risco, mas não grava
set role authenticated; select set_config('request.jwt.claim.sub', :'F', false) \gset
insert into resultado select 'governador le riscos','3',count(*)::text from riscos;
do $$ begin
  begin
    insert into riscos (grupo_id,ponto_critico,descricao,probabilidade,impacto,criado_por)
    values (3,'x','y',1,1,'00000000-0000-0000-0000-00000000000f');
    insert into resultado values ('governador nao grava risco','bloqueado','PERMITIU');
  exception when others then
    insert into resultado values ('governador nao grava risco','bloqueado','bloqueado');
  end;
end $$;
reset role;

-- 16. membro assina o termo sozinho
set role authenticated; select set_config('request.jwt.claim.sub', :'E', false) \gset
select assinar_termo();
reset role;
insert into resultado select 'termo assinado','sim', case when termo_assinado_em is not null then 'sim' else 'nao' end
from membros where id=:'E';

select caso, esperado, obtido, case when esperado=obtido then 'OK' else 'FALHOU' end as resultado from resultado;
