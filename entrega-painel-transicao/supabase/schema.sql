-- Painel da Transição – esquema do banco (Supabase / PostgreSQL 15+)
--
-- Rascunho para a versão real. Foi aplicado e exercitado num PostgreSQL 16 local com
-- esquema `auth` simulado (ver supabase/TESTE.md). NÃO foi testado no Supabase de verdade
-- nem revisado por especialista em segurança. Revise antes de usar com dados reais.
--
-- Princípios:
--   * Ambiente SEPARADO do site de campanha: crie um projeto Supabase novo.
--   * Só entra quem a Administração aprovou E que assinou o termo de confidencialidade.
--   * Cada pessoa vê apenas o grupo temático a que pertence, salvo os perfis com acesso total.
--   * Quem declarou conflito numa área (membro_bloqueios) não acessa aquela área.
--   * Toda alteração relevante vai para a trilha de auditoria.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tipos
create type perfil as enum (
  'administracao', 'coordenacao_geral', 'secretaria_executiva',
  'nucleo', 'coordenador_grupo', 'tecnico_grupo', 'governador_eleito');
create type status_bloco as enum (
  'nao_solicitado', 'solicitado', 'parcial', 'entregue', 'validado', 'nao_entregue');
create type status_oficio as enum ('aberto', 'respondido', 'nao_entregue');
create type situacao_autoridade as enum ('conferido', 'imprensa', 'a_definir');

-- ---------------------------------------------------------------- tabelas
create table grupos (
  id   smallint primary key,
  nome text not null unique
);

create table membros (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nome                  text not null,
  perfil                perfil not null default 'tecnico_grupo',
  grupo_id              smallint references grupos(id),
  aprovado              boolean not null default false,
  termo_assinado_em     timestamptz,
  vinculo_governo_atual boolean not null default false,
  criado_em             timestamptz not null default now()
);

-- áreas bloqueadas por conflito de interesses
create table membro_bloqueios (
  membro_id uuid not null references membros(id) on delete cascade,
  grupo_id  smallint not null references grupos(id),
  motivo    text,
  primary key (membro_id, grupo_id)
);

create table autoridades (
  id            uuid primary key default gen_random_uuid(),
  orgao         text not null,
  sigla         text,
  titular       text,
  tratamento    char(1) not null default '?' check (tratamento in ('M', 'F', '?')),
  cargo         text not null,
  grupo_id      smallint references grupos(id),
  situacao      situacao_autoridade not null default 'a_definir',
  observacao    text,
  atualizado_em timestamptz not null default now()
);

create table oficios (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique,            -- ex.: 011/2026
  grupo_id    smallint not null references grupos(id),
  autoridade_id uuid references autoridades(id),
  assunto     text not null,
  modelo      text,
  texto       text,                            -- texto completo do ofício
  enviado_em  date not null,
  prazo_em    date not null,                   -- enviado_em + 5 dias úteis (calculado pelo app)
  status      status_oficio not null default 'aberto',
  blocos      smallint[] not null default '{}',-- blocos do relatório (1 a 8) afetados
  criado_por  uuid references membros(id),
  criado_em   timestamptz not null default now(),
  check (prazo_em >= enviado_em)
);

-- caminho = chave do arquivo no Storage (bucket privado "anexos")
create table oficio_anexos (
  id         uuid primary key default gen_random_uuid(),
  oficio_id  uuid not null references oficios(id) on delete cascade,
  caminho    text not null,
  nome       text not null,
  enviado_por uuid references membros(id),
  criado_em  timestamptz not null default now()
);

create table relatorio_blocos (
  grupo_id      smallint not null references grupos(id),
  bloco         smallint not null check (bloco between 1 and 8),
  status        status_bloco not null default 'nao_solicitado',
  dados         jsonb not null default '{}',   -- campos das tabelas e textos do bloco
  atualizado_em timestamptz not null default now(),
  primary key (grupo_id, bloco)
);

create table relatorio_anexos (
  id        uuid primary key default gen_random_uuid(),
  grupo_id  smallint not null,
  bloco     smallint not null,
  caminho   text not null,
  nome      text not null,
  enviado_por uuid references membros(id),
  criado_em timestamptz not null default now(),
  foreign key (grupo_id, bloco) references relatorio_blocos(grupo_id, bloco) on delete cascade
);

create table riscos (
  id            uuid primary key default gen_random_uuid(),
  grupo_id      smallint not null references grupos(id),
  ponto_critico text not null,
  descricao     text not null,
  probabilidade smallint not null check (probabilidade between 1 and 3),
  impacto       smallint not null check (impacto between 1 and 3),
  nota          smallint generated always as (probabilidade * impacto) stored,
  classificacao text generated always as (
    case when probabilidade * impacto >= 6 then 'critico'
         when probabilidade * impacto >= 3 then 'alto'
         else 'moderado' end) stored,
  medida        text,
  responsavel   text,
  prazo         date,
  criado_por    uuid references membros(id),
  criado_em     timestamptz not null default now()
);

create table declaracoes_conflito (
  id          uuid primary key default gen_random_uuid(),
  membro_id   uuid not null references membros(id) on delete cascade,
  respostas   jsonb not null,
  resultado   text not null check (resultado in ('liberado', 'liberado_com_restricoes', 'aguardando_parecer')),
  aprovada    boolean not null default false,
  decidido_por uuid references membros(id),
  decidido_em timestamptz,
  criado_em   timestamptz not null default now()
);

create table auditoria (
  id       bigint generated always as identity primary key,
  usuario  uuid,
  acao     text not null,
  tabela   text not null,
  registro text,
  detalhe  jsonb,
  em       timestamptz not null default now()
);

create index on oficios (grupo_id, status);
create index on oficios (prazo_em);
create index on riscos (grupo_id, nota desc);
create index on auditoria (tabela, em desc);

insert into grupos (id, nome) values
  (0, 'Fazenda'), (1, 'Planejamento e Administração'), (2, 'Previdência'), (3, 'Saúde'),
  (4, 'Educação'), (5, 'Segurança Pública'), (6, 'Infraestrutura e Logística'),
  (7, 'Agricultura e Meio Ambiente'), (8, 'Assistência Social e Desenvolvimento'),
  (9, 'Casa Civil, PGE e Controladoria'), (10, 'Estatais');

-- ---------------------------------------------------------------- funções de acesso
-- Perfil de quem está logado, só se aprovado e com termo assinado. Caso contrário, nulo.
create function meu_perfil() returns perfil
language sql stable security definer set search_path = '' as $$
  select m.perfil from public.membros m
  where m.id = auth.uid() and m.aprovado and m.termo_assinado_em is not null
$$;

create function meu_grupo() returns smallint
language sql stable security definer set search_path = '' as $$
  select m.grupo_id from public.membros m
  where m.id = auth.uid() and m.aprovado and m.termo_assinado_em is not null
$$;

create function acesso_total() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_perfil() in ('administracao', 'coordenacao_geral', 'secretaria_executiva'), false)
$$;

create function eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meu_perfil() = 'administracao', false)
$$;

-- Pode ver/alterar dados do grupo g? Acesso total, ou membro do grupo sem bloqueio por conflito.
create function pode_grupo(g smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.acesso_total()
      or (public.meu_perfil() in ('nucleo', 'coordenador_grupo', 'tecnico_grupo')
          and public.meu_grupo() = g
          and not exists (select 1 from public.membro_bloqueios b
                          where b.membro_id = auth.uid() and b.grupo_id = g))
$$;

-- Assinatura do termo pelo próprio membro (registra o momento; não aprova o acesso).
create function assinar_termo() returns void
language sql security definer set search_path = '' as $$
  update public.membros set termo_assinado_em = now()
  where id = auth.uid() and termo_assinado_em is null
$$;

-- ---------------------------------------------------------------- auditoria e carimbo de tempo
create function audita() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria (usuario, acao, tabela, registro, detalhe)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
          case tg_op when 'DELETE' then to_jsonb(old)
                     else jsonb_build_object('novo', to_jsonb(new),
                                             'antigo', case tg_op when 'UPDATE' then to_jsonb(old) end) end);
  return coalesce(new, old);
end $$;

create trigger aud_oficios after insert or update or delete on oficios for each row execute function audita();
create trigger aud_oficio_anexos after insert or update or delete on oficio_anexos for each row execute function audita();
create trigger aud_relatorio_blocos after insert or update or delete on relatorio_blocos for each row execute function audita();
create trigger aud_riscos after insert or update or delete on riscos for each row execute function audita();
create trigger aud_declaracoes after insert or update or delete on declaracoes_conflito for each row execute function audita();
create trigger aud_membros after insert or update or delete on membros for each row execute function audita();
create trigger aud_autoridades after insert or update or delete on autoridades for each row execute function audita();

create function carimba() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger t_carimba_bloco before update on relatorio_blocos for each row execute function carimba();
create trigger t_carimba_aut before update on autoridades for each row execute function carimba();

-- ---------------------------------------------------------------- permissões e RLS
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

alter table grupos enable row level security;
alter table membros enable row level security;
alter table membro_bloqueios enable row level security;
alter table autoridades enable row level security;
alter table oficios enable row level security;
alter table oficio_anexos enable row level security;
alter table relatorio_blocos enable row level security;
alter table relatorio_anexos enable row level security;
alter table riscos enable row level security;
alter table declaracoes_conflito enable row level security;
alter table auditoria enable row level security;

-- grupos: lista pública para quem está logado
create policy grupos_ler on grupos for select to authenticated using (true);

-- membros: cada um vê o próprio registro; acesso total vê todos; só a Administração altera.
create policy membros_ler on membros for select to authenticated
  using (id = auth.uid() or public.acesso_total());
create policy membros_criar_proprio on membros for insert to authenticated
  with check (id = auth.uid() and not aprovado and perfil = 'tecnico_grupo'
              and grupo_id is null and termo_assinado_em is null);
create policy membros_admin_altera on membros for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
create policy membros_admin_apaga on membros for delete to authenticated using (public.eh_admin());

create policy bloqueios_ler on membro_bloqueios for select to authenticated
  using (membro_id = auth.uid() or public.acesso_total());
create policy bloqueios_admin on membro_bloqueios for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- autoridades: qualquer membro liberado lê; acesso total edita
create policy aut_ler on autoridades for select to authenticated using (public.meu_perfil() is not null);
create policy aut_editar on autoridades for all to authenticated
  using (public.acesso_total()) with check (public.acesso_total());

-- ofícios e anexos
create policy of_ler on oficios for select to authenticated using (public.pode_grupo(grupo_id));
create policy of_criar on oficios for insert to authenticated
  with check (public.pode_grupo(grupo_id) and criado_por = auth.uid()
              and public.meu_perfil() <> 'governador_eleito');
create policy of_alterar on oficios for update to authenticated
  using (public.pode_grupo(grupo_id) and public.meu_perfil() <> 'governador_eleito')
  with check (public.pode_grupo(grupo_id));
create policy of_apagar on oficios for delete to authenticated using (public.eh_admin());

create policy ofa_ler on oficio_anexos for select to authenticated
  using (exists (select 1 from oficios o where o.id = oficio_id and public.pode_grupo(o.grupo_id)));
create policy ofa_criar on oficio_anexos for insert to authenticated
  with check (enviado_por = auth.uid()
              and exists (select 1 from oficios o where o.id = oficio_id and public.pode_grupo(o.grupo_id)));
create policy ofa_apagar on oficio_anexos for delete to authenticated using (public.eh_admin());

-- relatório por bloco (o governador eleito só lê)
create policy rb_ler on relatorio_blocos for select to authenticated
  using (public.pode_grupo(grupo_id) or public.meu_perfil() = 'governador_eleito');
create policy rb_escrever on relatorio_blocos for all to authenticated
  using (public.pode_grupo(grupo_id) and public.meu_perfil() <> 'governador_eleito')
  with check (public.pode_grupo(grupo_id) and public.meu_perfil() <> 'governador_eleito');

create policy rba_ler on relatorio_anexos for select to authenticated using (public.pode_grupo(grupo_id));
create policy rba_criar on relatorio_anexos for insert to authenticated
  with check (public.pode_grupo(grupo_id) and enviado_por = auth.uid()
              and public.meu_perfil() <> 'governador_eleito');
create policy rba_apagar on relatorio_anexos for delete to authenticated using (public.eh_admin());

-- riscos: técnico de grupo não registra risco; governador eleito só lê
create policy rk_ler on riscos for select to authenticated
  using (public.pode_grupo(grupo_id) or public.meu_perfil() = 'governador_eleito');
create policy rk_criar on riscos for insert to authenticated
  with check (public.pode_grupo(grupo_id) and criado_por = auth.uid()
              and public.meu_perfil() not in ('tecnico_grupo', 'governador_eleito'));
create policy rk_alterar on riscos for update to authenticated
  using (public.pode_grupo(grupo_id) and public.meu_perfil() not in ('tecnico_grupo', 'governador_eleito'))
  with check (public.pode_grupo(grupo_id));
create policy rk_apagar on riscos for delete to authenticated using (public.eh_admin());

-- declaração de conflito: o membro cria e vê a sua; só a Administração decide.
-- Obs.: aqui o membro pode declarar mesmo sem estar aprovado, pois a declaração vem ANTES do acesso.
create policy dc_ler on declaracoes_conflito for select to authenticated
  using (membro_id = auth.uid() or public.eh_admin());
create policy dc_criar on declaracoes_conflito for insert to authenticated
  with check (membro_id = auth.uid() and not aprovada and decidido_por is null);
create policy dc_decidir on declaracoes_conflito for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- auditoria: só a Administração lê; ninguém altera (gravação só pelos gatilhos)
create policy aud_ler on auditoria for select to authenticated using (public.eh_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on auditoria from authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.assinar_termo() to authenticated;

-- ---------------------------------------------------------------- Storage (fazer no painel do Supabase)
-- 1. Crie o bucket PRIVADO "anexos" (public = false).
-- 2. Organize as chaves como  <grupo_id>/<oficio ou bloco>/<arquivo>  e crie políticas em
--    storage.objects que usem public.pode_grupo(((storage.foldername(name))[1])::smallint).
-- 3. Gere links temporários (signed URLs) para baixar; nunca torne o bucket público.
