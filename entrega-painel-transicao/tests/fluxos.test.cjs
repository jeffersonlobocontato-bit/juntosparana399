// Teste dos fluxos do protótipo (ligações entre abas). Uso:
//   npm i -D playwright && npx playwright install chromium
//   node tests/fluxos.test.cjs
// Opcional: PAINEL=/caminho/outro.html node tests/fluxos.test.cjs
const { chromium } = require('playwright');
const path = require('path');

const ARQ = process.env.PAINEL || path.join(__dirname, '..', 'painel-transicao.html');
const falhas = [];
const confere = (nome, ok, detalhe = '') => {
  console.log(`${ok ? 'OK    ' : 'FALHOU'}  ${nome}${ok ? '' : '  ' + detalhe}`);
  if (!ok) falhas.push(nome);
};

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  // Sem internet: só o arquivo local carrega (a fonte do Google cai para a padrão).
  await p.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await p.goto('file://' + ARQ);

  const aba = t => p.click(`#tabs button[data-tab=${t}]`);
  // 0. Estado inicial: sem dados de exemplo
  {
    const ab = t => p.click(`#tabs button[data-tab=${t}]`);
    await ab('of');   confere('inicial: nenhum ofício de exemplo', (await p.locator('#view tbody tr').count()) === 0);
    await ab('risk'); confere('inicial: nenhum risco de exemplo', (await p.locator('#view tbody tr').count()) === 0);
    await ab('conf'); confere('inicial: nenhuma declaração de exemplo', (await p.locator('#view tbody tr').count()) === 0);
    await ab('dash');
    const rotulos = await p.locator('.cellbtn').evaluateAll(l => l.map(x => x.getAttribute('aria-label')));
    confere('inicial: as 88 células da matriz estão "Não solicitado"', rotulos.length === 88 && rotulos.every(x => /Não solicitado/.test(x)));
    confere('inicial: indicadores zerados (ofícios, riscos)', (await p.locator('.kpi .n').allInnerTexts()).slice(0, 4).join(',') === '0%,0,0,0');
    let achou = false;
    for (const t of ['dash', 'of', 'gen', 'aut', 'rel', 'risk', 'team', 'eqm', 'eqr', 'conf', 'dados']) {
      await ab(t); if (/\(exemplo\)|Membro [ABC]\b/.test(await p.locator('#view').innerText())) achou = true;
    }
    confere('inicial: nenhuma tela traz "exemplo" nem Membro A/B/C', !achou);
    await ab('dash');
  }

  const texto = async s => (await p.locator(s).first().innerText());
  const celula = (g, b) => p.locator(`.cellbtn[data-g="${g}"][data-b="${b}"]`).getAttribute('aria-label');
  const linhas = s => p.locator(s).count();

  // 1. Ofício: gerar, registrar, ver texto, ligar à matriz, impedir duplicidade
  await aba('dash');
  confere('matriz: Fazenda bloco 1 começa "Não solicitado"', /Não solicitado/.test(await celula(0, 0)), await celula(0, 0));
  await aba('of'); const antes = await linhas('#view tbody tr');
  await aba('gen');
  await p.selectOption('#g-org', '12');            // Secretaria do Planejamento
  await p.selectOption('#g-tpl', 'pessoal');
  await p.selectOption('#g-grp', '0');
  await p.click('#g-reg');
  confere('gerador: mensagem de registro', /registrado/.test(await texto('#g-bar')));
  await p.click('#g-reg');
  confere('gerador: bloqueia registro duplicado', /já foi registrado/.test(await texto('#g-bar')));
  await aba('of');
  confere('ofícios: nova linha na tabela', (await linhas('#view tbody tr')) === antes + 1);
  await p.locator('button[data-ver]').first().click();
  confere('ofícios: "Ver ofício" mostra o texto guardado', /OFÍCIO Nº/.test(await texto('.paper')));
  await aba('dash');
  confere('painel: bloco passou a "Solicitado"', /Solicitado/.test(await celula(0, 0)), await celula(0, 0));
  await aba('of');
  await p.setInputFiles('tr:has-text("001/2026") input[data-respfile]',
    [{ name: 'resposta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }]);
  confere('ofícios: anexo da resposta aparece', /resposta\.pdf/.test(await texto('#view')));
  await aba('dash');
  confere('painel: bloco passou a "Entregue"', /Entregue/.test(await celula(0, 0)), await celula(0, 0));

  // 2. Relatório: anexo, campo e linha extra sobrevivem à troca de aba
  await aba('rel');
  await p.setInputFiles('input[data-attach="0"]',
    [{ name: 'folha.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }]);
  await p.fill('details.blk >> nth=0 >> input >> nth=0', '123');
  await p.click('details.blk >> nth=2 >> summary');
  await p.click('[data-addrow="2"]');
  await aba('dash'); await aba('rel');
  confere('relatório: anexo persiste', /folha\.pdf/.test(await texto('#files-0')));
  confere('relatório: campo preenchido persiste', (await p.inputValue('details.blk >> nth=0 >> input >> nth=0')) === '123');
  confere('relatório: linha extra de contrato', (await linhas('details.blk >> nth=2 >> tbody tr')) === 3);

  // 3. Mapa de riscos
  await aba('risk'); const r0 = await linhas('#view tbody tr');
  await p.fill('#rk-d', 'Risco de teste'); await p.selectOption('#rk-pr', '3'); await p.selectOption('#rk-im', '3');
  await p.click('#rk-add');
  confere('riscos: nova linha no mapa', (await linhas('#view tbody tr')) === r0 + 1);
  await aba('dash');
  confere('painel: riscos críticos aumentaram', (await p.locator('.kpi .n').allInnerTexts())[3] === '1');

  // 4. Autoridades alimentam o gerador
  await aba('aut'); const a0 = await linhas('#aut-body tr');
  await p.fill('#a-o', 'Secretaria de Teste'); await p.fill('#a-n', 'Fulano de Tal'); await p.click('#a-add');
  confere('autoridades: nova linha', (await linhas('#aut-body tr')) === a0 + 1);
  await aba('gen');
  confere('gerador: lista inclui a nova autoridade', (await p.locator('#g-org option').allInnerTexts()).includes('Secretaria de Teste'));

  // 5. Conflito de interesses
  await aba('conf');
  for (const q of ['forn', 'par', 'atual', 'cargo', 'lobby', 'doa', 'info']) await p.check(`input[name=q-${q}][value=n]`);
  await p.fill('#c-nome', 'Teste'); await p.check('#c-termo'); await p.click('#c-send');
  confere('conflito: declaração entra na fila', /Teste/.test(await texto('#view')));

  // 6. Tema escuro
  await p.click('#theme-btn');
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  confere('tema escuro aplica o azul da paleta', bg === 'rgb(6, 27, 46)', bg);

  // 6b. Equipes de transição (Decreto nº 15.659)
  await aba('eqm');
  confere('equipe Moro: 10 indicados pelo decreto', (await linhas('#eq-body tr')) === 10);
  confere('equipe Moro: coordenador-geral é Lucas Alves de Lima Barros de Góes',
    /Lucas Alves de Lima Barros de Góes/.test(await p.locator('#eq-body input[data-ef="n"]').first().inputValue()));
  await aba('eqr');
  confere('equipe Ratinho: 13 integrantes (3 coordenadores e 10 membros)', (await linhas('#eq-body tr')) === 13);
  await aba('dash');
  const pend0 = (await p.locator('.kpi .n').allInnerTexts())[4];
  await aba('eqm');
  await p.check('input[data-ef="t"] >> nth=0');
  await aba('dash');
  confere('equipe Moro: termo assinado reduz os termos pendentes do painel', (await p.locator('.kpi .n').allInnerTexts())[4] === String(+pend0 - 1), pend0);
  await aba('eqm');
  await p.selectOption('select[data-ef="g"] >> nth=1', '3');
  await p.fill('#e-n', 'Pessoa de Teste'); await p.selectOption('#e-p', 'Colaborador'); await p.click('[data-eadd="moro"]');
  confere('equipe Moro: nova pessoa entra na lista', (await linhas('#eq-body tr')) === 11);
  await p.fill('#e-n', 'pessoa de teste'); await p.click('[data-eadd="moro"]');
  confere('equipe Moro: nome repetido é recusado', /Já existe/.test(await texto('#view .warn')) && (await linhas('#eq-body tr')) === 11);
  await aba('conf');
  for (const q of ['forn', 'par', 'atual', 'cargo', 'lobby', 'doa', 'info']) await p.check(`input[name=q-${q}][value=n]`);
  await p.fill('#c-nome', 'Vinicius Klein'); await p.check('#c-termo'); await p.click('#c-send');
  await aba('eqm');
  confere('conflito: declaração de integrante vira "Em análise" na equipe', /Em análise/.test(await texto('#eq-body')));
  await aba('conf');
  await p.locator('tr:has-text("Vinicius Klein") [data-capr]').click();
  await aba('eqm');
  confere('conflito: aprovação da Administração vira "Aprovada" na equipe', /Aprovada/.test(await texto('#eq-body')));
  await aba('gen'); await p.selectOption('#g-sig', 'coord');
  const ofc = await p.locator('#g-doc').innerText();
  confere('gerador: cita o Decreto nº 15.659/2026', /Decreto nº 15\.659\/2026/.test(ofc));
  confere('gerador: assinatura pelo coordenador-geral da equipe do eleito', /Lucas Alves de Lima Barros de Góes\s+Coordenador-Geral da Equipe de Transição do Governador eleito/.test(ofc));
  await aba('eqr');
  await p.fill('#e-q', 'adur');
  confere('equipe Ratinho: busca filtra a lista', (await linhas('#eq-body tr')) === 1);
  await p.fill('#e-q', '');

  // 7. Salvar e restaurar dados
  await aba('dados');
  const estado = await p.evaluate(() => JSON.stringify(exportState()));
  const dados = JSON.parse(estado);
  confere('dados: exportação traz ofício com o texto completo', dados.oficios.some(o => /OFÍCIO Nº/.test(o.txt)));
  confere('dados: exportação traz risco, autoridade e anexo do relatório',
    dados.riscos.some(r => r.d === 'Risco de teste') && dados.autoridades.some(a => a.o === 'Secretaria de Teste')
    && Object.values(dados.anexosRelatorio).some(l => l.includes('folha.pdf')));
  confere('dados: exportação traz as duas equipes', dados.equipes && dados.equipes.moro.length === 11 && dados.equipes.ratinho.length === 13);
  await p.reload();                                   // o salvamento automático deve devolver tudo
  await aba('of');
  confere('dados: salvamento automático sobrevive ao recarregar', /001\/2026/.test(await texto('#view')));
  await aba('risk');
  confere('dados: risco continua após recarregar', /Risco de teste/.test(await texto('#view')));

  // outro computador (contexto limpo): restaurar do texto exportado
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await p2.goto('file://' + ARQ);
  await p2.click('#tabs button[data-tab=of]');
  const antes2 = await p2.locator('#view tbody tr').count();
  await p2.click('#tabs button[data-tab=dados]');
  await p2.fill('#d-txt', 'isto não é json');
  await p2.click('#d-rest');
  confere('dados: texto inválido é recusado', /Erro/.test(await p2.locator('#view .warn').first().innerText()));
  await p2.fill('#d-txt', estado);
  await p2.click('#d-rest');
  confere('dados: restauração informa o que voltou', /Dados restaurados/.test(await p2.locator('#view .okmsg').first().innerText()));
  await p2.click('#tabs button[data-tab=of]');
  confere('dados: ofícios restaurados no outro computador', (await p2.locator('#view tbody tr').count()) > antes2);
  await p2.click('#tabs button[data-tab=eqm]');
  confere('dados: equipe restaurada no outro computador', (await p2.locator('#eq-body tr').count()) === 11);
  await p2.click('#tabs button[data-tab=gen]');
  confere('dados: autoridade restaurada aparece no gerador', (await p2.locator('#g-org option').allInnerTexts()).includes('Secretaria de Teste'));
  await p2.click('#tabs button[data-tab=dados]');
  await p2.click('#d-reset'); await p2.click('#d-reset');
  await p2.click('#tabs button[data-tab=risk]');
  confere('dados: "voltar aos dados de exemplo" limpa o que foi restaurado', !/Risco de teste/.test(await p2.locator('#view').innerText()));
  await ctx2.close();

  // dados salvos por versão anterior (chave v1) podem ser recuperados, mas não aparecem sozinhos
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await p3.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await p3.goto('file://' + ARQ);
  await p3.evaluate(() => { const o = exportState(); o.riscos = [{ g: 3, p: 'x', d: 'Risco antigo', pr: 3, im: 3, r: '', pz: '' }]; localStorage.setItem('painel-transicao-v1', JSON.stringify(o)); });
  await p3.reload();
  await p3.click('#tabs button[data-tab=risk]');
  confere('versão anterior: dados antigos não reaparecem sozinhos', !/Risco antigo/.test(await p3.locator('#view').innerText()));
  await p3.click('#tabs button[data-tab=dados]');
  confere('versão anterior: painel oferece recuperar', (await p3.locator('#d-antigo').count()) === 1);
  await p3.click('#d-antigo');
  await p3.click('#tabs button[data-tab=risk]');
  confere('versão anterior: recuperação traz os dados', /Risco antigo/.test(await p3.locator('#view').innerText()));
  await ctx3.close();

  confere('sem erros de JavaScript', erros.length === 0, erros.join(' | '));
  await browser.close();
  console.log(falhas.length ? `\n${falhas.length} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
  process.exit(falhas.length ? 1 : 0);
})();
