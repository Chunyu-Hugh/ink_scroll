#!/usr/bin/env node
/**
 * 墨卷 · RSI scorecard  (harness-level RSI, after awesome-rsi "Harness & Scaffold Evolution")
 *
 * One machine-checkable fitness vector for the repo. The loop is:
 *   score → pick the weakest dimension → mutate (one thing) → score again
 *   → keep only if no dimension regressed → append to archive.json → repeat.
 *
 *   node tools/rsi/score.mjs            # score the current tree (reads last e2e run)
 *   node tools/rsi/score.mjs --run      # run the 141-assertion suite first, then score
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

if (process.argv.includes('--run')) {
  console.log('▸ running the evaluator (this takes ~6 min)…');
  execFileSync('node', ['tools/test.js'], { cwd: ROOT, stdio: 'inherit' });
}

const html = read('web/index.html');
const dims = {};

// 1. e2e — the honest one: real browser, real model inference
const last = exists('tools/last-run.json') ? JSON.parse(read('tools/last-run.json')) : null;
dims.e2e = last ? { v: last.pass / Math.max(1, last.pass + last.fail), d: `${last.pass}/${last.pass + last.fail} assertions` }
                : { v: 0, d: 'never run' };

// 2. i18n parity — three locales, identical key sets
const i18n = (() => {
  const m = html.match(/const I18N = \{[\s\S]*?\n\};/)[0];
  const o = new Function(m.replace('const I18N', 'var I') + ';return I;')();
  const keys = Object.keys(o.en);
  const missing = [];
  for (const l of Object.keys(o)) for (const k of keys) if (!(k in o[l])) missing.push(l + ':' + k);
  return { locales: Object.keys(o).length, keys: keys.length, missing: missing.length };
})();
dims.i18n = { v: i18n.missing === 0 ? 1 : 0, d: `${i18n.keys} keys × ${i18n.locales} locales, ${i18n.missing} missing` };

// 3. registry ↔ docs coverage (docs are part of the contract)
const doc = read('docs/INTERACTIONS.md');
const modes = [...html.matchAll(/^  ([a-z]+):\{\n    icon:/gm)].map((m) => m[1]);
const undocumented = modes.filter((k) => !doc.includes('`' + k + '`'));
dims.docsCoverage = { v: modes.length ? (modes.length - undocumented.length) / modes.length : 0,
  d: `${modes.length} modes, ${undocumented.length} undocumented${undocumented.length ? ' (' + undocumented.join(',') + ')' : ''}` };

// 4. every mode must degrade: a fallback or a hint on the failure path
// resolve `init(){ fooStart(); }` → the body of fooStart() as well, so failure
// handling written in the engine counts (the old heuristic only read the entry)
function modeSources(k) {
  const at = html.indexOf(`  ${k}:{\n    icon:`);
  const end = html.indexOf('\n  },', at);
  const seg = html.slice(at, end > at ? end : at + 1600);
  const called = [...seg.matchAll(/init\(\)\{ *([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]);
  const bodies = called.map((fn) => {
    let f = html.indexOf(`function ${fn}(`);
    if (f < 0) f = html.indexOf(`async function ${fn}(`);
    if (f < 0) return '';
    let depth = 0, i = html.indexOf('{', f);
    for (let j = i; j < html.length; j++) {
      if (html[j] === '{') depth++;
      else if (html[j] === '}' && --depth === 0) return html.slice(i, j);
    }
    return '';
  });
  return seg + '\n' + bodies.join('\n');
}
// 契约：模态可以显式声明 fallback（'pointer' | 'hint' | 'none'）；
// 没声明的才退回启发式扫描（并会被这条低分持续提醒去补声明）
const needsFallback = modes.filter((k) => {
  const src = modeSources(k);
  const declared = /fallback:\s*'(pointer|hint|none)'/.test(src);
  if (declared) return false;
  return !/wM\('mouse'|flashHint|return null|\|\| null|不可失败/.test(src);
});
dims.degradation = { v: modes.length ? (modes.length - needsFallback.length) / modes.length : 0,
  d: `${needsFallback.length} modes without an explicit failure path${needsFallback.length ? ' (' + needsFallback.join(',') + ')' : ''}` };

// 5. single-file constraint (the project's one hard rule)
const deps = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((u) => /^https?:/.test(u));
dims.singleFile = { v: deps.length <= 4 ? 1 : 0, d: `${deps.length} CDN scripts, ${(html.length / 1024 | 0)} KB index.html, ${exists('package.json') ? 'build file!' : 'no build step'}` };

// 6. accessibility surface
const a11y = ['role="img"', 'aria-live', 'aria-modal', 'prefers-reduced-motion', 'role="toolbar"'];
const have = a11y.filter((k) => html.includes(k) || read('web/index.html').includes(k));
dims.a11y = { v: have.length / a11y.length, d: `${have.length}/${a11y.length} (${a11y.join(', ')})` };

// 7. tests that actually assert the core mechanic
// every registered mode should be exercised by the evaluator, not just be a card
const testSrc = read('tools/test.js');
const untested = modes.filter((k) => !testSrc.includes(`'${k}'`));
dims.modeCoverage = { v: modes.length ? (modes.length - untested.length) / modes.length : 0,
  d: `${untested.length}/${modes.length} modes without an assertion${untested.length ? ' (' + untested.join(',') + ')' : ''}` };

dims.coreMechanic = { v: /光圈内的颜色与圈外不同/.test(read('tools/test.js')) ? 1 : 0,
  d: 'reveal-in-reveal assertion + real-inference group' };

const total = Object.values(dims).reduce((a, d) => a + d.v, 0) / Object.keys(dims).length;
const weak = Object.entries(dims).sort((a, b) => a[1].v - b[1].v).filter(([, d]) => d.v < 1);

console.log(JSON.stringify({ at: new Date().toISOString(), total: +total.toFixed(3), dims, weak: weak.map(([k]) => k) }, null, 2));
console.log('\n' + Object.entries(dims).map(([k, d]) => `  ${(d.v * 100).toFixed(0).padStart(3)}%  ${k.padEnd(14)} ${d.d}`).join('\n'));
console.log(`\n  fitness ${(total * 100).toFixed(1)}%   weakest: ${weak.length ? weak[0][0] : '—'}`);

// archive: append one row per round (the variant ledger)
const arch = exists('tools/rsi/archive.json') ? JSON.parse(read('tools/rsi/archive.json')) : [];
let sha = 'uncommitted';
try { sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch {}
arch.push({ at: new Date().toISOString(), sha, fitness: +total.toFixed(3),
  weak: weak.map(([k, d]) => ({ dim: k, v: +d.v.toFixed(3), why: d.d })) });
fs.writeFileSync(path.join(ROOT, 'tools/rsi/archive.json'), JSON.stringify(arch.slice(-200), null, 2));
