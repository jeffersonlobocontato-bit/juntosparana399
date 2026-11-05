# Pasta de dados

| Arquivo | O que é |
|---|---|
| `dados-iniciais.json` | O estado inicial do painel: 11 grupos × 8 blocos todos como "Não solicitado", sem ofícios, riscos nem declarações, a base de 32 autoridades (não conferidas) e as duas equipes de transição do Decreto nº 15.659 (10 indicados do governador eleito e 13 integrantes da Comissão de Transição do governo atual). |

## Como usar
1. Abra `painel-transicao.html` no navegador.
2. Vá na aba **Salvar e restaurar**.
3. Escolha o arquivo `.json` em **Restaurar de um arquivo** (ou cole o conteúdo em "Ou cole os dados aqui" e clique em **Restaurar do texto**).

## Para levar os SEUS dados para outro computador
Na aba **Salvar e restaurar** do painel em que você trabalhou, clique em **Baixar dados (arquivo JSON)**. Se o navegador bloquear o download, use **Copiar dados** e cole em um arquivo de texto salvo como `.json`. Guarde o arquivo nesta pasta (por exemplo `dados/meus-dados-2026-11-05.json`) e restaure na outra máquina.

## O que o arquivo guarda
Ofícios com o texto completo e anexos (só os nomes), riscos, autoridades e sua situação, declarações de conflito, situação de cada bloco no painel, campos preenchidos do relatório, linhas extras de contratos e obras, as equipes de transição (grupo temático, contato, termo de sigilo e situação da declaração de conflito) e as configurações do gerador (decreto, e-mail, prazo, assinatura).

## O que o arquivo NÃO guarda
O **conteúdo** dos arquivos anexados (só os nomes), a escolha de fundo escuro e qualquer coisa que esteja só em outra aba aberta e ainda não tenha sido registrada.

## Cuidados
Se a pasta for para um repositório, **não envie arquivos de dados reais com informações de pessoas ou documentos sigilosos**. Os arquivos `dados/meus-*.json` já estão no `.gitignore`.
