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
  await p.setInputFiles('tr:has-text("011/2026") input[data-respfile]',
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
  confere('painel: riscos críticos aumentaram', (await p.locator('.kpi .n').allInnerTexts())[3] === '3');

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

  confere('sem erros de JavaScript', erros.length === 0, erros.join(' | '));
  await browser.close();
  console.log(falhas.length ? `\n${falhas.length} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
  process.exit(falhas.length ? 1 : 0);
})();
