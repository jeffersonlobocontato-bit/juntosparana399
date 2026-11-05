#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera o instalador de arquivo único do Painel da Transição.

Uso:
    python3 instalador/gerar-instalador.py [PASTA_DO_PROJETO] [PASTA_DE_SAIDA]

Padrões: a pasta do projeto é a pasta acima de `instalador/`; a saída é `dist/`.
Cria em PASTA_DE_SAIDA:
    instalar-painel-transicao.py   (o projeto inteiro dentro de um único arquivo)
    instalar-windows.bat           (atalho para Windows)
    LEIA-ME.txt                    (instruções para quem vai instalar)
Rode de novo sempre que o projeto mudar, para o instalador levar a versão mais recente.
"""
import base64, hashlib, io, os, shutil, sys, zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PROJETO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else AQUI.parent
SAIDA = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else PROJETO / "dist"

IGNORAR_PASTAS = {"node_modules", "dist", ".git", "__pycache__", ".vscode", ".idea"}
IGNORAR_ARQ = {".DS_Store", "Thumbs.db", ".env"}


def ignorado(rel: Path) -> bool:
    partes = rel.parts
    if any(p in IGNORAR_PASTAS for p in partes[:-1]):
        return True
    nome = partes[-1]
    if nome in IGNORAR_ARQ or nome.startswith(".env.") or nome.endswith(".zip"):
        return True
    if partes[0] == "dados" and nome.startswith("meus-") and nome.endswith(".json"):
        return True  # backups pessoais nunca entram no instalador
    return False


def montar_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for caminho in sorted(PROJETO.rglob("*")):
            if not caminho.is_file():
                continue
            rel = caminho.relative_to(PROJETO)
            if ignorado(rel):
                continue
            z.write(caminho, rel.as_posix())
    return buf.getvalue()


MODELO = r'''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Instalador do Painel da Transição (arquivo único, versão @@VERSAO@@).

Instala o projeto completo (protótipo, contexto para o Claude, tutorial, checklist,
banco, testes e dados) em uma pasta do seu computador. Só usa a biblioteca padrão do Python.

    python3 instalar-painel-transicao.py                  instala em ~/PainelTransicao
    python3 instalar-painel-transicao.py --destino PASTA  instala em outra pasta
    python3 instalar-painel-transicao.py --atualizar      atualiza uma instalação existente
    python3 instalar-painel-transicao.py --abrir          abre o painel no navegador ao final
    python3 instalar-painel-transicao.py --listar         mostra o que vai ser instalado

Segurança: o conteúdo é conferido por SHA-256 antes de extrair, caminhos suspeitos são
recusados, nada é apagado e, ao atualizar, a pasta `dados/` e uma cópia da versão atual são preservadas.
"""
import argparse, base64, hashlib, io, os, shutil, sys, time, webbrowser, zipfile
from pathlib import Path

VERSAO = "@@VERSAO@@"
SHA256 = "@@SHA256@@"
PAYLOAD = """
@@PAYLOAD@@
"""


def saida_utf8():
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def carregar_zip() -> zipfile.ZipFile:
    dados = base64.b64decode("".join(PAYLOAD.split()))
    if hashlib.sha256(dados).hexdigest() != SHA256:
        sys.exit("ERRO: o instalador está corrompido (a conferência SHA-256 falhou). Baixe o arquivo de novo.")
    return zipfile.ZipFile(io.BytesIO(dados))


def nome_seguro(destino: Path, nome: str) -> Path:
    if not nome or nome.startswith(("/", "\\")) or ":" in nome.split("/")[0] or "\\" in nome:
        raise ValueError(f"caminho recusado: {nome!r}")
    alvo = (destino / nome).resolve()
    raiz = destino.resolve()
    if raiz != alvo and raiz not in alvo.parents:
        raise ValueError(f"caminho fora da pasta de destino: {nome!r}")
    return alvo


def pergunta(texto: str, sim: bool) -> bool:
    if sim:
        return True
    try:
        return input(texto + " [s/N] ").strip().lower() in ("s", "sim", "y", "yes")
    except EOFError:
        return False


def copiar_backup(origem: Path) -> Path:
    destino = origem.with_name(origem.name + ".backup-" + time.strftime("%Y%m%d-%H%M%S"))
    shutil.copytree(origem, destino, ignore=shutil.ignore_patterns("node_modules"))
    return destino


def principal() -> int:
    saida_utf8()
    ap = argparse.ArgumentParser(description="Instala o Painel da Transição.")
    ap.add_argument("--destino", default=str(Path.home() / "PainelTransicao"), help="pasta de instalação")
    ap.add_argument("--atualizar", action="store_true", help="atualiza uma pasta que já existe (com cópia de segurança)")
    ap.add_argument("--sim", action="store_true", help="responde sim às perguntas")
    ap.add_argument("--abrir", action="store_true", help="abre o painel no navegador ao final")
    ap.add_argument("--listar", action="store_true", help="só lista o conteúdo, sem instalar")
    a = ap.parse_args()

    z = carregar_zip()
    nomes = [i for i in z.infolist() if not i.is_dir()]
    if a.listar:
        for i in nomes:
            print(f"{i.file_size:>9}  {i.filename}")
        print(f"\n{len(nomes)} arquivos, versão {VERSAO}")
        return 0

    destino = Path(a.destino).expanduser()
    existe = destino.exists() and any(destino.iterdir())
    backup = None
    if existe:
        print(f"A pasta {destino} já existe e tem conteúdo.")
        if not (a.atualizar or pergunta("Atualizar mesmo assim? Uma cópia da pasta atual será guardada e a pasta dados/ não será sobrescrita.", a.sim)):
            print("Nada foi alterado. Use --destino para outra pasta ou --atualizar para atualizar.")
            return 1
        backup = copiar_backup(destino)
        print(f"Cópia de segurança: {backup}")
    destino.mkdir(parents=True, exist_ok=True)

    novos = pulados = 0
    for info in nomes:
        alvo = nome_seguro(destino, info.filename)
        if info.filename.startswith("dados/") and alvo.exists():
            pulados += 1  # nunca sobrescreve dados do usuário
            continue
        alvo.parent.mkdir(parents=True, exist_ok=True)
        with z.open(info) as origem, open(alvo, "wb") as f:
            shutil.copyfileobj(origem, f)
        if alvo.suffix in (".sh", ".command"):
            alvo.chmod(0o755)
        novos += 1

    print(f"\nInstalado em: {destino}")
    print(f"{novos} arquivos gravados" + (f", {pulados} arquivos de dados preservados" if pulados else "") + f" (versão {VERSAO}).")
    html = destino / "painel-transicao.html"

    print("\nPróximos passos")
    print(f"1. Ver o painel: abra {html} no navegador (dois cliques).")
    print("2. Se você recebeu um arquivo de dados (.json): no painel, aba 'Salvar e restaurar', carregue o arquivo.")
    if shutil.which("claude"):
        print(f"3. Continuar com o Claude Code:  cd \"{destino}\"  e depois  claude   (digite /primeiro-contato)")
    else:
        print("3. Para continuar com o Claude Code, instale-o primeiro (https://code.claude.com/docs), depois:")
        print(f"   cd \"{destino}\"  e  claude   (digite /primeiro-contato)")
    if not shutil.which("node"):
        print("   (Opcional) Para rodar os testes, instale o Node.js 18+ em https://nodejs.org")
    print("4. Leia TUTORIAL.md e CHECKLIST.md na pasta instalada.")
    if backup:
        print(f"\nSe algo ficou diferente do esperado, a versão anterior está em: {backup}")
    if a.abrir:
        try:
            webbrowser.open(html.as_uri())
        except Exception:
            print("Não consegui abrir o navegador automaticamente.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
'''

BAT = r'''@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set "SCRIPT=%~dp0instalar-painel-transicao.py"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%SCRIPT%" --abrir %*
  goto fim
)
where python >nul 2>nul
if %errorlevel%==0 (
  python "%SCRIPT%" --abrir %*
  goto fim
)
echo.
echo Nao encontrei o Python neste computador.
echo 1. Instale o Python em https://www.python.org/downloads/ (marque "Add python.exe to PATH").
echo 2. Rode este arquivo de novo.
echo.
echo Alternativa sem Python: extraia o arquivo entrega-painel-transicao.zip (botao direito, Extrair tudo).
:fim
echo.
pause
'''

LEIAME = '''INSTALADOR DO PAINEL DA TRANSIÇÃO
==================================

O que é
-------
Um instalador de arquivo único (instalar-painel-transicao.py) que coloca o projeto
completo no seu computador: o painel, o contexto para o Claude, o tutorial, o checklist,
o rascunho do banco, os testes e os dados que já vêm preenchidos.

Como instalar
-------------
Windows:   dois cliques em instalar-windows.bat (precisa do Python, de python.org).
Mac/Linux: abra o Terminal nesta pasta e rode:
               python3 instalar-painel-transicao.py --abrir

Por padrão instala na pasta  PainelTransicao  dentro da sua pasta pessoal.
Para escolher outra:  python3 instalar-painel-transicao.py --destino "CAMINHO"

Depois da instalação
--------------------
1. O painel abre no navegador (ou abra painel-transicao.html com dois cliques).
2. Se você recebeu um arquivo de dados (.json) junto com o instalador, abra a aba
   "Salvar e restaurar" no painel e carregue esse arquivo. Isso traz de volta tudo o
   que a outra pessoa já tinha preenchido.
3. Para continuar melhorando com o Claude:
      cd PainelTransicao
      claude
   e digite /primeiro-contato.
4. Leia o TUTORIAL.md e o CHECKLIST.md dentro da pasta instalada.

Atualizar uma instalação que já existe
--------------------------------------
Rode o instalador de novo com --atualizar. Ele guarda uma cópia da pasta atual (nome
PainelTransicao.backup-DATA) e NÃO sobrescreve nada dentro de dados/.
Atenção: arquivos fora de dados/ que você alterou voltam à versão do instalador.
Se você já melhorou o painel, use a cópia de segurança para recuperar as suas mudanças.

Segurança
---------
- O instalador confere o conteúdo com SHA-256 antes de extrair e recusa caminhos suspeitos.
- Ele não apaga nada e não usa a internet.
- Não coloque dados reais de pessoas ou documentos sigilosos no protótipo.
'''


def main():
    zip_bytes = montar_zip()
    sha = hashlib.sha256(zip_bytes).hexdigest()
    b64 = base64.b64encode(zip_bytes).decode("ascii")
    linhas = "\n".join(b64[i:i + 100] for i in range(0, len(b64), 100))
    versao = sha[:8]
    SAIDA.mkdir(parents=True, exist_ok=True)
    py = MODELO.replace("@@VERSAO@@", versao).replace("@@SHA256@@", sha).replace("@@PAYLOAD@@", linhas)
    (SAIDA / "instalar-painel-transicao.py").write_text(py, encoding="utf-8", newline="\n")
    (SAIDA / "instalar-windows.bat").write_text(BAT.replace("\n", "\r\n"), encoding="utf-8", newline="")
    (SAIDA / "LEIA-ME.txt").write_text(LEIAME, encoding="utf-8", newline="\n")
    n = len(zipfile.ZipFile(io.BytesIO(zip_bytes)).namelist())
    print(f"Instalador gerado em {SAIDA}")
    print(f"  {n} arquivos do projeto, {len(zip_bytes) / 1024:.0f} KB compactados, versão {versao}")


if __name__ == "__main__":
    main()
