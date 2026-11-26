# sys-comm unificado: decoder → Chat | Cipher

O `index.html` publicado tem só a **casca** em claro: a tela do decoder. Todo o resto vai cifrado nele: a página dos cards, o Chat, o Cipher e o cadastro de usuários.

## Fluxo
1. **Decoder.** A chave do **root** é o código hexadecimal que aparece na linha `セッション` (`session`, em inglês) do boot **com um ponto no final**: copie o código (o duplo clique seleciona ele inteiro), cole e acrescente o `.`. Sem o ponto, o código não abre. Para trocar esse código: `node _ferramentas/montar.mjs --novo-codigo`. O © do rodapé troca o idioma. Os **demais usuários** usam como chave a **própria senha de login (Senha 1) escrita ao contrário**.
2. **Cards.** **Chat** abre o Garden (ou o shogi, se o navegador não tiver WebGPU). **Cipher** abre o xadrez.
3. **Login escondido.** No computador, Ctrl/⌘+clique: no Garden, em qualquer lugar; no shogi e no xadrez, no rei branco. Em tela de toque, toque duplo no mesmo ponto.
4. **Um só cadastro: o `VAULT_DB` do Cipher.** O Cipher usa as 3 senhas. O Chat usa só a Senha 1. No Chat, quem abre a sala é o **root**: os outros mandam usuário e senha a ele pelo canal P2P cifrado, e ele confere antes de aceitar.

## Trocar senhas ou usuários
Entre no Cipher como root, vá em **GESTÃO DE USUÁRIOS**, altere o que precisar e clique em "gerar sistema atualizado".
- O arquivo baixado (`index_V-….html`) é o **sistema completo**, já cifrado: ele vira o novo `index.html` do repositório.
- Ao gravar a Senha 1 de um usuário, o Cipher cria o campo `dk` dele: a chave do conteúdo cifrada pela senha invertida.
- **Usuário sem `dk` não passa do decoder.** É o caso de quem ainda não teve a senha definida por essa tela.

## Editar o código
O repositório é público, então o código em claro fica só em `_fontes/`, que está no `.gitignore`.

```
node _ferramentas/abrir.mjs      # pede a chave do decoder; decifra index.html em _fontes/
# editar _fontes/casca.html, inicio.html, chat.html, chat.js ou cipher.html
node _ferramentas/montar.mjs     # cifra _fontes/ em index.html (mantém a chave e a impressão)
```

- O `montar.mjs` lê a impressão digital em `_fontes/impressao.txt` e confere o resultado antes de gravar.
- O Hub (`marceloclr.gitlab.io/tools/mensagens.mjs`) lê `_fontes/cipher.html`, então rode o `abrir.mjs` antes dele.

## Segurança (escolha do usuário, registrada)
- A chave do root fica à vista na página pública: a proteção depende só de ninguém saber que aquela linha é uma chave.
- A chave dos outros é a Senha 1 invertida: quem souber uma sabe a outra.
- O conteúdo usa AES-256-GCM, e as chaves do decoder passam por PBKDF2-SHA256 com 300.000 iterações.

## Metadados dos anexos do Chat
Antes de enviar um arquivo, o Chat abre um popup com todos os metadados lidos. As caixas vêm marcadas, e o que estiver marcado sai **só da cópia enviada**. O nome do arquivo é editável e pode ser sorteado. O núcleo é o objeto `META`, entre os marcadores `/*@META-INICIO@*/` e `/*@META-FIM@*/` do `_fontes/chat.js`. Ele não usa DOM, então roda no Node.

```
node _ferramentas/testar-meta.mjs            # usa _fontes/chat.js e as amostras de _fontes/_testes/fx
VERBOSE=1 node _ferramentas/testar-meta.mjs  # lista cada item lido
```

- **Amostras:** `_fontes/_testes/gerar-fixtures.py` (fotos), `gerar-fixtures-docs.py` (DOCX, ODT, PDF), mais áudio, vídeo e compactados gerados com ffmpeg, zip, tar, 7z.
- **Teste de cada amostra:** lê os itens; limpa tudo e confere que nada removível sobrou; limpa uma parte e confere que os desmarcados ficaram.
- **Formatos que podem ser limpos:** JPEG, PNG, WebP, GIF, SVG, HEIC/AVIF, PDF, DOCX/XLSX/PPTX, ODT/ODS/ODP, MP4/MOV/M4A, MP3, FLAC, Ogg/Opus, WAV, ZIP, TAR, GZ/TGZ. Nos compactados, a limpeza vale também para os arquivos de dentro, até 2 níveis.
- **Só leitura:** 7z e RAR.
- **Fora daqui:** bz2, xz, zst. O popup avisa que o formato não é suportado e oferece só o envio do original.

## Versões na pasta
- **`index.html`:** sempre a versão atual.
- **`index-DDMMAAAA-HHMM.html`:** cópias com o **mesmo número do rodapé** (`V-DDMMAAAA-HHMM`). Assim dá para saber qual versão cada usuário está usando.
- **Cópia da atual:** `index-<versão atual>.html` existe junto com o `index.html`, com o mesmo conteúdo.
- **Automático:** o `montar.mjs` grava a cópia a cada montagem e mantém só as **5 últimas versões**. Também apaga as cópias de montagens que nunca foram publicadas (as que estão fora do git).
- **Ao publicar:** `git add -A -- 'index*.html'`, para levar ao git também as remoções.
- **Data de modificação:** a de cada cópia deve ser a hora do nome (`touch -d`), para que a ordenação por data no gerenciador de arquivos não engane.
