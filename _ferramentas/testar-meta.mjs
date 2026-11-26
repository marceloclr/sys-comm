// Testa o núcleo de metadados (seção META do chat.js) sem navegador.
// Uso: node _ferramentas/testar-meta.mjs [arquivo-com-META.js] [pasta-de-fixtures] [pasta-de-saida]
//   Padrões: _fontes/chat.js, _fontes/_testes/fx, _fontes/_testes/saida
//   Para cada arquivo: lê os itens; limpa tudo (nenhum item removível pode sobrar na releitura);
//   limpa parcialmente (os desmarcados ficam, os marcados somem). Grava as cópias para conferência externa.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fonte = process.argv[2] || path.join(raiz, '_fontes/chat.js');
const dirFx = process.argv[3] || path.join(raiz, '_fontes/_testes/fx');
const dirOut = process.argv[4] || path.join(raiz, '_fontes/_testes/saida');
const src = fs.readFileSync(fonte, 'utf8');
const a = src.indexOf('/*@META-INICIO@*/'), b = src.indexOf('/*@META-FIM@*/');
if (a < 0 || b < 0) throw new Error('marcadores META não encontrados em ' + fonte);
const ctx = vm.createContext({ TextDecoder, TextEncoder, Blob, Response, DecompressionStream, CompressionStream, Uint8Array, DataView, console });
vm.runInContext(src.slice(a, b) + '\nthis.META=META;', ctx);
const META = ctx.META;
fs.mkdirSync(dirOut, { recursive: true });
let falhas = 0;
const ok = (c, msg) => { if (!c) { falhas++; console.log('   ✗ ' + msg); } };
const verbose = process.env.VERBOSE;
for (const nome of fs.readdirSync(dirFx).sort()) {
  const u = new Uint8Array(fs.readFileSync(path.join(dirFx, nome)));
  const r = await META.analisar(u, nome);
  const rem = r.itens.filter(x => x.rem);
  console.log(`\n■ ${nome} · ${r.fmt || '?'} · ${r.itens.length} itens (${rem.length} removíveis)${r.erro ? ' · ERRO ' + r.erro : ''}`);
  if (verbose) r.itens.forEach(x => console.log(`   ${x.rem ? '☑' : ' ·'} [${x.g}] ${x.r} = ${x.v}${x.sens ? '  ⚠' : ''}   (${x.id})`));
  if (!r.suportado || r.erro) { ok(!r.erro, 'erro de leitura'); continue; }
  if (!rem.length) { console.log('   (sem metadados removíveis)'); continue; }
  // 1) tudo marcado
  const tudo = new Set(rem.map(x => x.id));
  const c1 = await META.limpar(u, r.fmt, tudo);
  const r1 = await META.analisar(c1, nome);
  const sobra = r1.itens.filter(x => tudo.has(x.id));
  ok(!r1.erro, 'releitura falhou: ' + r1.erro);
  ok(sobra.length === 0, 'sobraram: ' + sobra.map(x => x.id).join(', '));
  ok(u.length === new Uint8Array(fs.readFileSync(path.join(dirFx, nome))).length, 'o original mudou');
  fs.writeFileSync(path.join(dirOut, 'tudo-' + nome), c1);
  // 2) parcial: mantém os 2 primeiros removíveis e a orientação, se houver
  const manter = new Set(rem.filter((x, i) => i < 2 || /Orientation/.test(x.r)).map(x => x.id));
  const parc = new Set(rem.filter(x => !manter.has(x.id)).map(x => x.id));
  const c2 = await META.limpar(u, r.fmt, parc);
  const r2 = await META.analisar(c2, nome);
  const ids2 = new Set(r2.itens.map(x => x.id));
  ok(!r2.erro, 'releitura parcial falhou: ' + r2.erro);
  ok([...manter].every(id => ids2.has(id)), 'sumiram os mantidos: ' + [...manter].filter(id => !ids2.has(id)).join(', '));
  ok([...parc].every(id => !ids2.has(id)), 'sobraram no parcial: ' + [...parc].filter(id => ids2.has(id)).join(', '));
  fs.writeFileSync(path.join(dirOut, 'parcial-' + nome), c2);
  console.log(`   tudo: ${u.length} → ${c1.length} B · parcial (mantidos ${manter.size}): ${c2.length} B`);
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
