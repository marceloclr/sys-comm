// Monta o index.html unificado (decoder + cards + Chat + Cipher) a partir de _fontes/.
// Uso: node _ferramentas/montar.mjs
//   - mantém a chave do conteúdo K, o sal e a impressão digital do index.html atual
//     (abre K com _fontes/impressao.txt); na primeira vez, gera tudo novo;
//   - refaz CHAVES: a impressão digital (root) + o dk de cada usuário ativo do VAULT_DB;
//   - confere o resultado decifrando de novo antes de gravar.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FONTES, INDEX, ITER, ARQUIVOS, b64, cifrar, decifrar, derivar, lerIndex, abrirK, chavesDoVault, embaralhar } from './nucleo.mjs';

const ler = (n) => fs.readFileSync(path.join(FONTES, n), 'utf8');
const conteudo = { v: 1 };
for (const [k, n] of Object.entries(ARQUIVOS)) conteudo[k] = ler(n);
for (const m of ['/*@NUCLEO@*/null', '/*@CHAVES@*/[]', '/*@IMPRESSAO@*/'])
  if (!conteudo.casca.includes(m)) throw new Error('marcador ausente na casca: ' + m);
if (!conteudo.chat.includes('<!--@CHAT_JS@-->')) throw new Error('marcador <!--@CHAT_JS@--> ausente no chat.html');

// código do root ("impressão"): aparece no boot como um ID de sessão comum, 32 hex (128 bits).
// --novo-codigo gera outro; a chave do conteúdo K continua a mesma (abre com o código atual).
const novoCodigo = process.argv.includes('--novo-codigo');
const gerarCodigo = () => crypto.randomBytes(16).toString('hex');
const arqImp = path.join(FONTES, 'impressao.txt');
let impressao = fs.existsSync(arqImp) ? fs.readFileSync(arqImp, 'utf8').trim() : '';
const atual = fs.existsSync(INDEX) ? lerIndex(fs.readFileSync(INDEX, 'utf8')) : null;
let K, sal, iter;
if (atual) {
  K = abrirK(atual, atual.impressao);              // o código atual está no próprio index (é exibido)
  if (!K) throw new Error('o código exibido no index.html atual não abre a chave do conteúdo');
  if (!impressao) impressao = atual.impressao;
  sal = atual.nuc.s; iter = atual.nuc.n;
} else {
  K = crypto.randomBytes(32); sal = b64(crypto.randomBytes(16)); iter = ITER;
  console.log('primeira montagem: chave do conteúdo e sal novos');
}
if (novoCodigo || !impressao) { impressao = gerarCodigo(); console.log('código do decoder (root) novo'); }
fs.writeFileSync(arqImp, impressao + '\n');

const chaves = embaralhar([cifrar(derivar(impressao, sal, iter), K), ...chavesDoVault(conteudo.cipher)]);
const c = cifrar(K, Buffer.from(JSON.stringify(conteudo), 'utf8'));
const nuc = { s: sal, n: iter, i: c.i, c: c.c };
const html = conteudo.casca
  .replace('/*@NUCLEO@*/null', () => JSON.stringify(nuc))
  .replace('/*@CHAVES@*/[]', () => JSON.stringify(chaves))
  .replace('/*@IMPRESSAO@*/', () => impressao);

// conferência: a impressão abre K, e K abre um conteúdo igual ao das fontes
const idx = lerIndex(html);
const K2 = abrirK(idx, impressao);
const volta = JSON.parse(decifrar(K2, idx.nuc).toString('utf8'));
for (const k of Object.keys(ARQUIVOS)) if (volta[k] !== conteudo[k]) throw new Error('conferência falhou em ' + k);

fs.writeFileSync(INDEX, html);
console.log(`index.html: ${(html.length / 1024).toFixed(0)} KB · ${chaves.length} chave(s) de decoder (root + ${chaves.length - 1} usuário(s)) · conferido`);
