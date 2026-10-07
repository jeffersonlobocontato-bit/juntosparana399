# Checklist para o painel funcionar de verdade

Use em ordem e marque `[x]` conforme avança. Os itens com 🔒 não podem ser pulados antes de entrar qualquer dado real.

## 1. Decisões e confirmações (antes de construir)
- [ ] Pedir à coordenação o **PDF original do Kit de Transição** e o **decreto efetivamente publicado**, e ajustar os artigos que hoje estão entre colchetes (`art. [4º]`, `art. [5º]`).
- [ ] **Quem assina os ofícios:** o governador eleito sozinho ou os coordenadores previstos no decreto. Confirmar com o jurídico.
- [ ] Parecer da PGE ou do jurídico sobre as **regras de conflito de interesses**: grau de parentesco, bloqueio por área e participação de servidor do governo atual ou cedido.
- [ ] Decidir se há **exigência de hospedagem no Brasil ou em ambiente governamental**.
- [ ] Confirmar com a coordenação os **perfis de acesso** e quem fica em cada um. A Alcione Gomes é a administradora.
- [ ] Validar o protótipo com quem vai usar: nomes dos blocos, campos, fluxo de ofícios.

## 2. Dados que precisam ser conferidos
- [ ] 🔒 **Conferir cada titular** no Diário Oficial ou com a Casa Civil e marcar como "Conferido" (`docs/AUTORIDADES.md`). Hoje nenhum está conferido.
- [ ] Levantar os titulares que faltam: Desenvolvimento Social e Família, Administração e Previdência, Inovação, Chefia de Gabinete, Comunicação e as estatais.
- [ ] Levantar o **e-mail oficial de recebimento** de cada secretaria, para o campo "Respostas para" do ofício.
- [ ] Definir o **e-mail da coordenação** que recebe as respostas.

## 3. Contas e ambiente
- [ ] Criar **repositório privado novo**, separado do site de campanha.
- [ ] Criar **projeto Supabase novo**, separado do da campanha, em região no Brasil se disponível.
- [ ] Definir o **subdomínio** do Juntos Paraná 399 e quem controla o DNS.
- [ ] Escolher onde publicar o site (Vercel, Netlify ou Cloudflare Pages) e ligar o subdomínio.
- [ ] Instalar o Claude Code e rodar `npm install` e `npm test` na pasta do pacote, para confirmar que o ponto de partida funciona.

## 4. Banco de dados
- [ ] Revisar `supabase/schema.sql` com alguém que conheça bancos.
- [ ] Aplicar no projeto Supabase novo.
- [ ] Criar o **bucket privado `anexos`** e as políticas de acesso por grupo.
- [ ] 🔒 Repetir os testes de acesso **no Supabase de verdade**, com um usuário de cada perfil. O teste atual (`supabase/TESTE.md`) é só local.
- [ ] Ligar **backup automático** e definir quem o acompanha.

## 5. Construção (uma aba por vez, rodando os testes)
- [ ] Login por e-mail com **verificação em duas etapas**.
- [ ] Cadastro de membros com aprovação da Administração, **termo de confidencialidade com assinatura registrada** e declaração de conflito ligada ao bloqueio por área.
- [ ] Trocar os dados em memória por leitura e gravação no banco, começando por **Ofícios e prazos**, depois Gerador, Autoridades, Relatório, Riscos e Painel.
- [ ] **Anexos reais** no Storage, com link temporário para baixar.
- [ ] **Exportar o ofício em PDF e Word**, com timbre e assinatura configuráveis.
- [ ] Cálculo de **dias úteis** com feriados do Paraná e nacionais (o protótipo só pula fim de semana).
- [ ] Módulos que ainda não existem: pontos críticos por secretaria, Plano dos 100 dias, atos do dia 1, relatório consolidado e canal restrito para indícios de irregularidade.
- [ ] Notificações de prazo por e-mail (e WhatsApp, se quiserem).

## 6. Segurança e conformidade 🔒
- [ ] Nenhuma chave, senha ou `.env` no repositório.
- [ ] Regras de acesso (RLS) ligadas em **todas** as tabelas.
- [ ] Trilha de auditoria funcionando (quem viu, baixou e alterou).
- [ ] Marca d'água nos downloads de documentos sigilosos.
- [ ] Revisão do jurídico sobre **LGPD e Lei de Acesso à Informação**, com política de retenção e **devolução ou destruição dos dados no fim da transição**, como prevê o termo.
- [ ] Teste de invasão simples: tentar acessar dados de outro grupo com a conta de um técnico.
- [ ] Definir quem responde se houver vazamento ou acesso indevido.

## 7. Antes de entrar no ar
- [ ] Carga inicial: grupos, membros, autoridades conferidas e modelos de ofício revisados.
- [ ] **Treinar a equipe** (30 minutos por perfil) e entregar um guia curto de uso.
- [ ] Piloto com **um grupo** (por exemplo, Saúde) por alguns dias, com um ofício real.
- [ ] Remover os dados de exemplo e o aviso de protótipo.
- [ ] Definir o canal de suporte: quem a equipe chama quando travar.

## 8. Rotina durante a transição
- [ ] Alguém confere **diariamente** os ofícios vencendo e os não entregues no prazo.
- [ ] Revisão semanal do mapa de riscos pela coordenação.
- [ ] Marcos do calendário: relatório consolidado em **15/12/2026**, decisões pré-posse em **30/12**, posse em **6/1/2027**, relatório dos 100 dias em **15/4/2027**.
- [ ] Ao fim: exportar os relatórios finais, **arquivar e apagar** os dados conforme o termo.

## O que mais atrasa, na prática
1. Conferir os titulares e os e-mails oficiais.
2. O parecer jurídico sobre assinatura e conflito de interesses.
3. A liberação do subdomínio e do DNS.
