// Monta o index.html unificado (decoder + cards + Chat + Cipher) a partir de _fontes/.
// Uso: node _ferramentas/montar.mjs
//   - mantém a chave do conteúdo K, o sal e a impressão digital do index.html atual
//     (abre K com _fontes/impressao.txt); na primeira vez, gera tudo novo;
//   - refaz CHAVES: a impressão digital (root) + o dk de cada usuário ativo do VAULT_DB;
//   - confere o resultado decifrando de novo antes de gravar.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FONTES, INDEX, ITER, ARQUIVOS, b64, cifrar, decifrar, derivar, lerIndex, abrirK, chavesDoVault, embaralhar } from './nucleo.mjs';

const ler = (n) => fs.readFileSync(path.join(FONTES, n), 'utf8');
const conteudo = { v: 1 };
for (const [k, n] of Object.entries(ARQUIVOS)) conteudo[k] = ler(n);
// carimbo de versão do build (V-DDMMAAAA-HHMM): injetado no decoder e no Chat; no Cipher, que lê a
// versão do próprio <title>, o V-… do título é trocado pelo do build (antes ficava a data fixa da fonte)
const _ag = new Date(), _p2 = (n) => String(n).padStart(2, '0');
const VERSAO = 'V-' + _p2(_ag.getDate()) + _p2(_ag.getMonth() + 1) + _ag.getFullYear() + '-' + _p2(_ag.getHours()) + _p2(_ag.getMinutes());
for (const k of ['casca', 'chat', 'inicio']) conteudo[k] = conteudo[k].split('@@VERSAO@@').join(VERSAO);
conteudo.cipher = conteudo.cipher.replace(/(<title>[^<]*?)V-\d{8}-\d{4}/, (_, a) => a + VERSAO);
if (!conteudo.cipher.includes(VERSAO)) throw new Error('versão V-DDMMAAAA-HHMM ausente no <title> do cipher.html');
for (const m of ['/*@NUCLEO@*/null', '/*@CHAVES@*/[]', '/*@IMPRESSAO@*/'])
  if (!conteudo.casca.includes(m)) throw new Error('marcador ausente na casca: ' + m);
if (!conteudo.chat.includes('<!--@CHAT_JS@-->')) throw new Error('marcador <!--@CHAT_JS@--> ausente no chat.html');
// identidade visual única (identidade.css): a casca injeta no lugar do marcador, no Chat e no Cipher
for (const k of ['chat', 'cipher']) if (!conteudo[k].includes('/*@IDENTIDADE@*/')) throw new Error('marcador /*@IDENTIDADE@*/ ausente no ' + ARQUIVOS[k]);
// relatório de acesso (relatorio.js): injetado no Cipher e no chat.js pelo marcador
for (const k of ['cipher', 'chatjs']) if (!conteudo[k].includes('/*@RELATORIO@*/')) throw new Error('marcador /*@RELATORIO@*/ ausente no ' + ARQUIVOS[k]);

// código do root ("impressão"): aparece no boot como um ID de sessão comum, 32 hex (128 bits).
// --novo-codigo gera outro; a chave do conteúdo K continua a mesma (abre com o código atual).
const novoCodigo = process.argv.includes('--novo-codigo');
// a chave do decoder do root é o código exibido com um ponto no final
const chaveRoot = (codigo) => codigo + '.';
const gerarCodigo = () => crypto.randomBytes(16).toString('hex');
const arqImp = path.join(FONTES, 'impressao.txt');
let impressao = fs.existsSync(arqImp) ? fs.readFileSync(arqImp, 'utf8').trim() : '';
const atual = fs.existsSync(INDEX) ? lerIndex(fs.readFileSync(INDEX, 'utf8')) : null;
let K, sal, iter;
if (atual) {
  // a chave do root é o código exibido + "." (antes de 23/11 tarde, era o código puro)
  K = abrirK(atual, chaveRoot(atual.impressao)) || abrirK(atual, atual.impressao);
  if (!K) throw new Error('o código exibido no index.html atual não abre a chave do conteúdo');
  if (!impressao) impressao = atual.impressao;
  sal = atual.nuc.s; iter = atual.nuc.n;
} else {
  K = crypto.randomBytes(32); sal = b64(crypto.randomBytes(16)); iter = ITER;
  console.log('primeira montagem: chave do conteúdo e sal novos');
}
if (novoCodigo || !impressao) { impressao = gerarCodigo(); console.log('código do decoder (root) novo'); }
fs.writeFileSync(arqImp, impressao + '\n');

const chaves = embaralhar([cifrar(derivar(chaveRoot(impressao), sal, iter), K), ...chavesDoVault(conteudo.cipher)]);
const c = cifrar(K, Buffer.from(JSON.stringify(conteudo), 'utf8'));
const nuc = { s: sal, n: iter, i: c.i, c: c.c };
const html = conteudo.casca
  .replace('/*@NUCLEO@*/null', () => JSON.stringify(nuc))
  .replace('/*@CHAVES@*/[]', () => JSON.stringify(chaves))
  .replace('/*@IMPRESSAO@*/', () => impressao);

// conferência: a impressão abre K, e K abre um conteúdo igual ao das fontes
const idx = lerIndex(html);
const K2 = abrirK(idx, chaveRoot(impressao));
if (abrirK(idx, impressao)) throw new Error('o código sem o ponto não pode abrir');
const volta = JSON.parse(decifrar(K2, idx.nuc).toString('utf8'));
for (const k of Object.keys(ARQUIVOS)) if (volta[k] !== conteudo[k]) throw new Error('conferência falhou em ' + k);

fs.writeFileSync(INDEX, html);
console.log(`index.html: ${(html.length / 1024).toFixed(0)} KB · ${chaves.length} chave(s) de decoder (root + ${chaves.length - 1} usuário(s)) · conferido`);

// Cópia com o número da versão (index-DDMMAAAA-HHMM.html, igual ao V- do rodapé): serve para saber
// qual versão cada usuário está usando. Ficam só as 5 últimas versões; cópias de montagens que nunca
// foram publicadas (fora do git) saem. As removidas aqui saem do git com `git add -A -- 'index*.html'`.
const raizRepo = path.dirname(INDEX);
const nomeVer = 'index-' + VERSAO.slice(2) + '.html';
const ordem = (n) => { const m = n.match(/^index-(\d{2})(\d{2})(\d{4})-(\d{4})\.html$/); return m ? m[3] + m[2] + m[1] + m[4] : null; };
fs.writeFileSync(path.join(raizRepo, nomeVer), html);
let rastreados = new Set();
try { rastreados = new Set(execFileSync('git', ['ls-files', '--', 'index-*.html'], { cwd: raizRepo }).toString().split('\n').filter(Boolean)); } catch { /* fora do git */ }
for (const n of fs.readdirSync(raizRepo).filter(ordem)) {
  if (n !== nomeVer && !rastreados.has(n)) { fs.unlinkSync(path.join(raizRepo, n)); console.log('cópia não publicada removida: ' + n); }
}
const copias = fs.readdirSync(raizRepo).filter(ordem).sort((a, b) => ordem(a).localeCompare(ordem(b)));
for (const n of copias.slice(0, Math.max(0, copias.length - 5))) { fs.unlinkSync(path.join(raizRepo, n)); console.log('versão antiga removida (fica no histórico do git): ' + n); }
console.log('cópia da versão: ' + nomeVer + ' · versões na pasta: ' + fs.readdirSync(raizRepo).filter(ordem).sort((a, b) => ordem(a).localeCompare(ordem(b))).join(', '));
