// Funções comuns de montar.mjs e abrir.mjs: o formato do index.html unificado.
//   var NUCC   = {s: sal, n: iterações, i: iv, c: conteúdo}   (AES-256-GCM com a chave K)
//   var CHAVES = [{i, c}, …]   K cifrada por PBKDF2-SHA256(chave do decoder, sal)
//   var IMPRESSAO = '…'        a chave do root, exibida na tela do decoder
// O conteúdo é o JSON {v, casca, inicio, chat, chatjs, cipher}. Mesmo formato do WebCrypto
// (texto cifrado seguido da etiqueta de 16 bytes), para a casca abrir no navegador.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FONTES = path.join(RAIZ, '_fontes');
export const INDEX = path.join(RAIZ, 'index.html');
export const ITER = 300000;
export const ARQUIVOS = { casca: 'casca.html', inicio: 'inicio.html', chat: 'chat.html', chatjs: 'chat.js', cipher: 'cipher.html', identidade: 'identidade.css', relatorio: 'relatorio.js' };

export const b64 = (b) => Buffer.from(b).toString('base64');
export const deB64 = (s) => Buffer.from(s, 'base64');

export function cifrar(chave32, dados) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave32, iv);
  const ct = Buffer.concat([c.update(dados), c.final(), c.getAuthTag()]);
  return { i: b64(iv), c: b64(ct) };
}
export function decifrar(chave32, item) {
  const ct = deB64(item.c);
  const d = crypto.createDecipheriv('aes-256-gcm', chave32, deB64(item.i));
  d.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
}
export const derivar = (chave, sal, iter) => crypto.pbkdf2Sync(Buffer.from(chave, 'utf8'), deB64(sal), iter, 32, 'sha256');

/** Lê NUCC, CHAVES e IMPRESSAO de um index.html unificado (ou null se ainda não for). */
export function lerIndex(html) {
  const n = html.match(/var NUCC=(\{[^\n]*?\});/);
  const k = html.match(/var CHAVES=(\[[^\n]*?\]);/);
  const p = html.match(/var IMPRESSAO='([^'\n]*)';/);
  if (!n || !k || !p) return null;
  return { nuc: JSON.parse(n[1]), chaves: JSON.parse(k[1]), impressao: p[1] };
}
/** Abre K com uma chave do decoder; devolve os bytes de K ou null. */
export function abrirK(idx, chave) {
  const dk = derivar(chave, idx.nuc.s, idx.nuc.n);
  for (const item of idx.chaves) { try { return decifrar(dk, item); } catch { /* próxima */ } }
  return null;
}
/** dk dos usuários ativos (menos root) no VAULT_DB do Cipher, no formato {i, c}. */
export function chavesDoVault(cipher) {
  const m = cipher.match(/const VAULT_DB = \{([\s\S]*?)\n\};/);
  if (!m) throw new Error('VAULT_DB não encontrado no cipher.html');
  const lista = [];
  for (const l of m[1].split('\n')) {
    const u = l.match(/^"([^"]+)":\s*\{(.*)\}\s*,?\s*$/);
    if (!u || u[1] === 'root' || /active:false/.test(u[2])) continue;
    const d = u[2].match(/dk:"([A-Za-z0-9+/=]+)\.([A-Za-z0-9+/=]+)"/);
    if (d) lista.push({ i: d[1], c: d[2] });
  }
  return lista;
}
export function embaralhar(a) {
  for (let j = a.length - 1; j > 0; j--) { const x = crypto.randomInt(j + 1); [a[j], a[x]] = [a[x], a[j]]; }
  return a;
}
