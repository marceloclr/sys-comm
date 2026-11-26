// Decifra o index.html unificado em _fontes/ (pasta fora do git, porque o repositório é público).
// Uso: node _ferramentas/abrir.mjs [--forcar]
//   A chave do decoder é pedida no terminal (ou vem de SYSCOMM_CHAVE). Use a impressão digital
//   mostrada na tela do decoder. Sem --forcar, não sobrescreve fontes que estejam diferentes.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { FONTES, INDEX, ARQUIVOS, decifrar, lerIndex, abrirK } from './nucleo.mjs';

const forcar = process.argv.includes('--forcar');
const idx = lerIndex(fs.readFileSync(INDEX, 'utf8'));
if (!idx) throw new Error('o index.html não está no formato unificado');
let chave = process.env.SYSCOMM_CHAVE;
if (!chave) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  chave = (await rl.question('chave do decoder: ')).trim();
  rl.close();
}
const K = abrirK(idx, chave);
if (!K) { console.error('chave errada'); process.exit(1); }
const c = JSON.parse(decifrar(K, idx.nuc).toString('utf8'));
// o montar.mjs troca @@VERSAO@@ pela data do build; aqui o marcador volta, para a próxima montagem
for (const k of ['casca', 'chat', 'inicio']) if (typeof c[k] === 'string') c[k] = c[k].replace(/V-\d{8}-\d{4}/g, '@@VERSAO@@');

fs.mkdirSync(FONTES, { recursive: true });
const saidas = Object.entries(ARQUIVOS).map(([k, n]) => [path.join(FONTES, n), c[k]]);
saidas.push([path.join(FONTES, 'impressao.txt'), idx.impressao + '\n']);
const diferentes = saidas.filter(([f, t]) => fs.existsSync(f) && fs.readFileSync(f, 'utf8') !== t).map(([f]) => path.basename(f));
if (diferentes.length && !forcar) {
  console.error('estas fontes locais diferem do index.html (use --forcar para sobrescrever): ' + diferentes.join(', '));
  process.exit(1);
}
for (const [f, t] of saidas) fs.writeFileSync(f, t);
console.log('fontes gravadas em _fontes/: ' + saidas.map(([f]) => path.basename(f)).join(', '));
