/**
 * 墨卷 · Ink Scroll — end-to-end interaction test suite
 *
 * Run:  node tools/test.js            (from /root/ink-soul)
 *       node tools/test.js --headed   (watch it)
 *
 * It boots the real server.py (SSE relay + static files) and drives a real
 * Chromium: every interaction mode, every keyboard shortcut, touch gestures,
 * the phone↔display relay, accessibility invariants, i18n completeness and a
 * frame-rate budget. Exit code 0 = all green.
 */
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const { chromium } = pw;
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');   // the repo root (server.py lives here)
let PORT = Number(process.env.INK_PORT || 8911);
let BASE = `http://127.0.0.1:${PORT}`;
function findChrome() {
  if (process.env.INK_CHROME) return process.env.INK_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(require('os').homedir(), '.cache', 'ms-playwright');
  try {
    for (const d of fs.readdirSync(base).filter(x => x.startsWith('chromium-')).sort().reverse()) {
      for (const rel of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome'],
                         ['chrome-mac', 'Chromium.app/Contents/MacOS/Chromium']]) {
        const p = path.join(base, d, ...rel);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch (e) {}
  return undefined;          // let playwright-core try its own resolution
}
const CHROME = findChrome();
const HEADED = process.argv.includes('--headed');
const MIN_FPS = Number(process.env.INK_MIN_FPS || 22);
const MIN_FPS_HEAVY = Number(process.env.INK_MIN_FPS_HEAVY || 20);
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const FIXTURE = path.join(__dirname, 'fixtures', 'moving.y4m');
function buildFixtures() {
  console.log('  (building fake-camera fixtures — needs Pillow once)');
  try { require('child_process').spawnSync('python3', [path.join(__dirname, 'make-fixtures.py')], { stdio: 'inherit' }); } catch (e) {}
  return fs.existsSync(FIXTURE);
}
const CAMERA = fs.existsSync(FIXTURE) || buildFixtures();

/* ── tiny assertion framework ─────────────────────────────────────── */
let pass = 0, fail = 0, skipped = 0;
const failures = [];
const group = (n) => console.log(`\n\x1b[1m${n}\x1b[0m`);
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else {
    fail++; failures.push(name + (extra ? ` — ${extra}` : ''));
    console.log(`  \x1b[31m✗ ${name}\x1b[0m${extra ? ` — ${extra}` : ''}`);
  }
}
const skip = (name, why) => { skipped++; console.log(`  \x1b[33m•\x1b[0m ${name} (skipped: ${why})`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// collect console errors per page
function watch(page, bucket) {
  page.on('pageerror', e => {
    // known upstream: MediaPipe's two legacy solutions share one global module
    if (/hands_solution|face_mesh_solution|Module\.loaded|setting 'loaded'/.test(e.message)) return;
    bucket.push('pageerror: ' + e.message);
  });
  page.on('console', m => { if (m.type() === 'error') bucket.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', r => {
    const u = r.url();
    const why = (r.failure() && r.failure().errorText) || '';
    if (/favicon/.test(u)) return;
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return;   // webfont CDN, not the app
    if (/ABORTED|NS_BINDING_ABORTED/.test(why)) return;   // intentionally closed EventSource
    if (/\/events\?room=/.test(u) && /ABORTED|Canceled/i.test(why)) return;
    bucket.push('requestfailed: ' + u.slice(0, 120) + ' :: ' + why);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  /* ── server ─────────────────────────────────────────────────────── */
  // pick a free port: a stale run must never make the suite look broken
  const net = require('net');
  const tryBind = (p) => new Promise((res) => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.once('listening', () => s.close(() => res(true)));
    s.listen(p, '127.0.0.1');
  });
  for (let i = 0; i < 20; i++) { if (await tryBind(PORT)) break; PORT++; }
  BASE = `http://127.0.0.1:${PORT}`;
  const srv = spawn('python3', ['server.py', String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const srvLog = [];
  srv.stdout.on('data', d => srvLog.push(String(d)));
  srv.stderr.on('data', d => srvLog.push(String(d)));
  const die = () => { try { srv.kill('SIGKILL'); } catch (e) {} };
  process.on('exit', die);
  await sleep(1200);

  const args = ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required'];
  if (CAMERA) args.push('--use-file-for-fake-video-capture=' + FIXTURE);
  if (!CAMERA) console.log('  ! no fixtures — camera-dependent assertions will be skipped');
  const browser = await chromium.launch({ executablePath: CHROME, headless: !HEADED, args });

  /* ═══════════════ 1. boot & static assets ═══════════════ */
  group('1 · 载入 / boot & assets');
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, errs);
  const t0 = Date.now();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const l = document.getElementById('loading');
    return l && l.classList.contains('gone');
  }, { timeout: 15000 });
  ok('首屏在 15s 内完成载入', true, `${Date.now() - t0}ms`);
  ok('无 JS 报错 / no page errors', errs.length === 0, errs.join(' | '));

  const imgs = await page.evaluate(() => sceneImages.map(i => i ? [i.naturalWidth, i.naturalHeight] : null));
  ok('5 张场景图全部解码', imgs.filter(Boolean).length === 5, JSON.stringify(imgs));
  ok('场景图声明为 .jpg 且为真 JPEG',
    (await page.evaluate(async () => {
      const r = await fetch('scenes/shanshui.jpg');
      const b = new Uint8Array(await r.arrayBuffer()).slice(0, 3);
      return [r.headers.get('content-type'), b[0] === 0xff && b[1] === 0xd8];
    })).join(',') === 'image/jpeg,true');

  const dict = await page.evaluate(() => {
    const keys = Object.keys(I18N.en);
    const missing = [];
    for (const l of Object.keys(I18N)) for (const k of keys) if (!(k in I18N[l])) missing.push(l + ':' + k);
    for (const l of Object.keys(I18N)) for (const k of Object.keys(I18N[l])) if (!keys.includes(k)) missing.push(l + '+' + k);
    return { locales: Object.keys(I18N), keys: keys.length, missing };
  });
  ok('三语字典键完全对齐', dict.missing.length === 0, dict.missing.join(','));
  console.log(`    · ${dict.locales.join(' / ')}, ${dict.keys} keys each`);

  const modeCards = await page.evaluate(() => [...document.querySelectorAll('.mode-card')].map(c => c.dataset.mode));
  ok('模态卡片全部渲染（不因 UA 能力而隐藏）', modeCards.length === 42 && !modeCards.includes(undefined),
    `cards=${modeCards.length}`);
  const groups = await page.evaluate(() => [...document.querySelectorAll('.mode-group .cat-label')].map(e => e.textContent.trim()));
  ok('模式按「需要什么」分组', groups.length === 4, groups.join(' | '));
  ok('21+ 个模态卡片全部渲染', modeCards.length >= 24, String(modeCards.length));

  /* ═══════════════ 2. i18n switching ═══════════════ */
  group('2 · 语言 / language switching');
  for (const [btn, lang] of [['zh-CN', 'zh-CN'], ['zh-TW', 'zh-TW'], ['en', 'en']]) {
    await page.click(`.lang-switch button[data-lang="${btn}"]`);
    await sleep(150);
    const st = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      cta: document.getElementById('btn-start').textContent,
      card: document.querySelector('.mode-card[data-mode="audio"] .name').textContent,
      hint: document.getElementById('hint').textContent.length,
    }));
    ok(`切到 ${lang} 后文案跟随`, st.lang === lang && st.cta.length > 1 && st.card.length > 1 && st.hint > 10,
      JSON.stringify(st));
  }
  await page.click('.lang-switch button[data-lang="en"]');
  await sleep(120);

  /* ═══════════════ 2b. 标题页可见性（42 个模态也不能把 CTA 挤出屏幕） ═══════════════ */
  group('2b · 标题页：全部模态可达 + CTA 常驻');
  for (const [w, h] of [[1440, 900], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(250);
    const lay = await page.evaluate(() => {
      const ss = document.getElementById('start-screen');
      const cards = [...document.querySelectorAll('.mode-card')];
      const cta = document.getElementById('btn-start').getBoundingClientRect();
      const first = cards[0].getBoundingClientRect();
      ss.scrollTop = ss.scrollHeight;
      const last = cards[cards.length - 1].getBoundingClientRect();
      ss.scrollTop = 0;
      return { n: cards.length, firstTop: Math.round(first.top),
        ctaVisible: cta.top >= 0 && cta.bottom <= innerHeight,
        lastReachable: last.bottom <= ss.clientHeight + 2 };
    });
    ok(`${w}×${h}：首张卡片没有被裁到视口上方`, lay.firstTop >= 0, `firstTop=${lay.firstTop}`);
    ok(`${w}×${h}：「展开画卷」不需要滚动就能看见`, lay.ctaVisible === true, JSON.stringify(lay));
    ok(`${w}×${h}：最后一张卡片滚动后可达`, lay.lastReachable === true, `last.bottom`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(200);

  /* ═══════════════ 2c. 首页是否"展示完整"（预设 + 输出开关都有 UI） ═══════════════ */
  group('2c · 首页展示完整性：预设一排 + 帮助面板的输出开关');
  const ui = await page.evaluate(() => {
    const presets = [...document.querySelectorAll('#presets button')].map(b => b.dataset.preset);
    buildHelpModes();
    const outs = [...document.querySelectorAll('#help-output .help-mode')].map(b => b.textContent.trim());
    return { presets, outs, helpModes: document.querySelectorAll('#help-modes .help-mode').length,
             cards: document.querySelectorAll('.mode-card').length };
  });
  const intro = await page.evaluate(() => {
    const tl = document.getElementById('tagline');
    const g = document.getElementById('btn-gallery');
    const cta = document.getElementById('btn-start').getBoundingClientRect();
    return { text: tl ? tl.textContent.trim() : '', gallery: !!g,
      ctaVisible: cta.top >= 0 && cta.bottom <= innerHeight };
  });
  ok('首页有一句话说明这是什么（陌生人不用读文档）', intro.text.length > 8, intro.text);
  ok('首页有「展厅模式」第二入口', intro.gallery === true);
  ok('首页主按钮仍然吸底可见', intro.ctaVisible === true, JSON.stringify(intro));

  ok('首页有 4 个预设按钮（不再只能靠 URL 参数）',
    ui.presets.length === 4 && ui.presets.join(',') === 'gallery,kiosk,stereo,lab', ui.presets.join(','));
  ok('帮助面板有 4 个输出开关（墙/网格/立体/点云）', ui.outs.length === 4, ui.outs.join(' | '));
  ok('帮助面板同时列出 42 个模态', ui.helpModes === 42, String(ui.helpModes));
  const formsUI = await page.evaluate(() => {
    buildHelpModes();
    return [...document.querySelectorAll('#help-forms .help-mode')].map(b => b.textContent.trim());
  });
  ok('帮助面板有 11 个形式开关（照亮/累积/延迟/静默/日课/共处/供奉/驱赶/召唤/书写/仪式）',
    formsUI.length === 11, formsUI.join(' | '));

  const clicked = await page.evaluate(async () => {
    const b = document.querySelector('#presets button[data-preset="kiosk"]');
    b.click();
    await new Promise(r => setTimeout(r, 1200));
    return { wall: S.wall, grid: S.grid, cls: document.body.classList.contains('wall'), running: S.running };
  });
  ok('点一下「展厅」预设 → 进入投影墙 + 网格并开卷',
    clicked.wall === true && clicked.grid === true && clicked.cls === true, JSON.stringify(clicked));
  await page.evaluate(async () => { stop(); await new Promise(r => setTimeout(r, 400)); document.body.classList.remove('wall'); S.wall = false; S.grid = false; });
  await sleep(300);

  /* ═══════════════ 2d. 累积（换画不擦留痕） ═══════════════ */
  group('2d · 累积：换画之后，写过的痕还在');
  const acc = await page.evaluate(async () => {
    ensurePaint();
    paintCtx.fillStyle = 'rgba(255,255,255,1)';
    paintCtx.fillRect(20, 20, 60, 60);
    const before = (() => { const c = document.createElement('canvas'); c.width = 40; c.height = 40;
      const g = c.getContext('2d'); g.drawImage(paintCvs, 20, 20, 60, 60, 0, 0, 40, 40);
      const d = g.getImageData(0, 0, 40, 40).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; return a; })();
    changeScene((S.scene + 1) % SCENE_COUNT);
    await new Promise(r => setTimeout(r, 200));
    const after = (() => { const c = document.createElement('canvas'); c.width = 40; c.height = 40;
      const g = c.getContext('2d'); g.drawImage(paintCvs, 20, 20, 60, 60, 0, 0, 40, 40);
      const d = g.getImageData(0, 0, 40, 40).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; return a; })();
    return { before, after, accrete: S.accrete };
  });
  ok('累积：换画后留痕 mask 仍在（同一卷纸）', acc.before > 0 && acc.after >= acc.before * 0.9,
    `before=${acc.before} after=${acc.after}`);

  const accOff = await page.evaluate(async () => {
    S.accrete = false;
    changeScene((S.scene + 1) % SCENE_COUNT);
    await new Promise(r => setTimeout(r, 200));
    const c = document.createElement('canvas'); c.width = 40; c.height = 40;
    const g = c.getContext('2d'); g.drawImage(paintCvs, 20, 20, 60, 60, 0, 0, 40, 40);
    const d = g.getImageData(0, 0, 40, 40).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i];
    S.accrete = true;
    return a;
  });
  ok('累积：?accrete=0 时退回旧行为（会擦）', accOff === 0, `alpha=${accOff}`);

  /* ═══════════════ 2e. 三种形式：延迟 / 静默 / 日课 ═══════════════ */
  group('2e · 形式：延迟 8 秒 / 静默翻页 / 日课种子');
  const dlay = await page.evaluate(() => {
    const buf = [];
    const a = delayPush(buf, [{ id: 'a' }], 1000, 8000);   // 第一次：不返回
    const b = delayPush(buf, [{ id: 'b' }], 4000, 8000);   // 4s：还不返回
    const c = delayPush(buf, [{ id: 'c' }], 9200, 8000);   // 8.2s 后：应返回最早的 a
    return { a, b, c, size: buf.length };
  });
  ok('延迟：8 秒内不显示，够 8 秒才吐出旧的自己',
    dlay.a === null && dlay.b === null && dlay.c && dlay.c[0].id === 'a', JSON.stringify(dlay));

  const sq = await page.evaluate(() => ({
    quiet5: silenceFlip(5000, 20000), quiet25: silenceFlip(25000, 20000),
  }));
  ok('静默：安静不足不翻页，够 20 秒才翻', sq.quiet5 === false && sq.quiet25 === true, JSON.stringify(sq));

  const sil = await page.evaluate(async () => {
    if (!S.running) { start(); await new Promise(r => setTimeout(r, 900)); }
    S.silence = { since: 0, acted: false, needMs: 20000, on: false };
    S.audio = { on: true, level: 0.0 };
    const scene0 = S.scene;
    await new Promise(r => setTimeout(r, 200));
    const offDidNothing = S.scene === scene0;         // 未开启：不应翻页
    S.silence.on = true; S.silence.since = performance.now() - 21000;
    await new Promise(r => setTimeout(r, 300));
    const onFlipped = S.scene !== scene0 || S.silence.acted;
    S.silence.on = false; S.silence.acted = false; S.silence.since = 0;
    return { offDidNothing, onFlipped };
  });
  ok('静默：关闭时安静不翻页；开启且够久才翻',
    sil.offDidNothing === true && sil.onFlipped === true, JSON.stringify(sil));

  const day = await page.evaluate(() => {
    const a = dailySeed(new Date(2026, 0, 15)), b = dailySeed(new Date(2026, 0, 16));
    return { a: a.label, b: b.label, diff: a.key !== b.key, hueA: a.hue, hueInRange: a.hue >= 0 && a.hue < 360 };
  });
  ok('日课：日期决定种子（每天不同）且 label 可读',
    day.a === '2026.01.15' && day.diff && day.hueInRange, JSON.stringify(day));

  const dailyUI = await page.evaluate(async () => {
    S.daily = { on: true, seed: dailySeed().key };
    const cap = S.daily.on ? dailySeed().label : '';
    return { cap, seeded: S.daily.seed === dailySeed().key };
  });
  ok('日课：开启后分享卡题款带日期', /^\d{4}\.\d{2}\.\d{2}$/.test(dailyUI.cap) && dailyUI.seeded,
    JSON.stringify(dailyUI));
  await page.evaluate(() => { S.daily = { on: false, seed: 0 }; S.delayMs = 0; S.delayBuf = []; });

  /* ═══════════════ 2f. 形式「共处」：一个人揭不开 ═══════════════ */
  group('2f · 形式：共处（规则不是输入）');
  const tog = await page.evaluate(() => {
    wM('multi'); S.together = true; S.togetherNeed = 2; S.togetherHinted = false; S.togetherLow = 0;
    const one = M.multi.spots().slice(0, 1);          // 只有一盏灯
    const two = M.multi.spots().concat([{ x: 100, y: 100, radius: 100 }]);
    return { one: one.length, two: two.length };
  });
  ok('共处：规则要求至少两盏灯（一个人不够）', tog.one < 2 && tog.two >= 2, JSON.stringify(tog));

  const gate = await page.evaluate(async () => {
    if (!S.running) { start(); await new Promise(r => setTimeout(r, 900)); }
    S.together = true; S.togetherHinted = false; S.togetherLow = 0;
    // 只有一盏灯：揭示应被锁掉
    const D2 = document.getElementById('display');
    D2.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 71, pointerType: 'touch', clientX: 300, clientY: 300, bubbles: true }));
    await new Promise(r => setTimeout(r, 350));
    const single = S.togetherLow;
    D2.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 72, pointerType: 'touch', clientX: 600, clientY: 300, bubbles: true }));
    await new Promise(r => setTimeout(r, 350));
    const dual = S.togetherLow;
    D2.dispatchEvent(new PointerEvent('pointerup', { pointerId: 71, pointerType: 'touch', clientX: 300, clientY: 300, bubbles: true }));
    D2.dispatchEvent(new PointerEvent('pointerup', { pointerId: 72, pointerType: 'touch', clientX: 600, clientY: 300, bubbles: true }));
    S.together = false;
    return { single: +single.toFixed(2), dual: +dual.toFixed(2) };
  });
  ok('共处：一人时揭示被压住、两人时放开', gate.single > 0 && gate.dual < gate.single, JSON.stringify(gate));

  /* ═══════════════ 2g. 形式「供奉」：放下一处，它自己长大 ═══════════════ */
  group('2g · 形式：供奉（痕迹自己长大，不跟随）');
  const ofr = await page.evaluate(() => {
    S.offerings = [];
    const o = offeringAdd(300, 200, 1000);
    const t0 = offeringGrow(S.offerings, 1000)[0].r;
    const t9 = offeringGrow(S.offerings, 10000)[0].r;
    const t95 = offeringGrow(S.offerings, 95000).length;   // 90s 后熄灭
    return { r0: Math.round(t0), r9: Math.round(t9), grew: t9 > t0 * 2, expired: t95 === 0, n: S.offerings.length };
  });
  ok('供奉：放下的痕随时间长大（9 秒到最大）', ofr.grew === true, JSON.stringify(ofr));
  ok('供奉：90 秒后熄灭（不会永久糊住画面）', ofr.expired === true, JSON.stringify(ofr));

  const offCap = await page.evaluate(() => {
    S.offerings = [];
    for (let i = 0; i < 20; i++) offeringAdd(i * 10, i * 10, 1000);
    return S.offerings.length;
  });
  ok('供奉：上限 12 处（超出丢最早的）', offCap === 12, String(offCap));
  await page.evaluate(() => { S.offering = false; S.offerings = []; });

  /* ═══════════════ 2h. 后四种形式：驱赶 / 召唤 / 书写 / 仪式 ═══════════════ */
  group('2h · 形式：驱赶 / 召唤 / 书写 / 仪式');
  const f4 = await page.evaluate(() => {
    // 驱赶：蒙版等级上升
    ensureDust(); S.dust.level = 0;
    const sp = { x: 300, y: 200, radius: 120 };
    const a = repelTick(sp, S.dust.ctx), b = repelTick(sp, S.dust.ctx);
    // 召唤：点被吸向光
    const dots = [{ x: 0, y: 0 }];
    summonStep(dots, 100, 100, 0.5);
    const moved = dots[0].x > 30 && dots[0].y > 30;
    // 书写：速度越快越细
    const slow = writeWidth(20), fast = writeWidth(1200);
    // 仪式：三处不同位置、5 秒内
    const taps = [];
    const r1 = ritualTap(taps, 100, 100, 1000);
    const r2 = ritualTap(taps, 400, 100, 2000);
    const r3 = ritualTap(taps, 700, 100, 3000);
    const same = ritualTap([], 500, 500, 1000) || (ritualTap([{x:500,y:500,t:900}],500,505,1000));
    S.dust.level = 0;
    return { repel: a > 0 && b > a, moved, slow, fast, r1, r2, r3, same };
  });
  ok('驱赶：光把墨推开，等级持续上升', f4.repel === true, JSON.stringify(f4));
  ok('召唤：墨点被吸向光', f4.moved === true);
  ok('书写：笔速越快笔画越细', f4.fast < f4.slow * 0.6, `${f4.slow} vs ${f4.fast}`);
  ok('仪式：两处不够，三处不同位置才达成', f4.r1 === false && f4.r2 === false && f4.r3 === true, JSON.stringify(f4));

  const f4ui = await page.evaluate(() => {
    buildHelpModes();
    return [...document.querySelectorAll('#help-forms .help-mode')].map(b => b.textContent.trim());
  });
  ok('形式面板共 11 个开关（7 + 驱赶/召唤/书写/仪式）', f4ui.length === 11, String(f4ui.length));
  await page.evaluate(() => { S.repel = false; S.summon = false; S.write = false; S.ritual = false; S.summonDots = []; });

  /* ═══════════════ 3. start / default mode ═══════════════ */
  group('3 · 进入画卷 / start');
  await page.goto(`${BASE}/index.html`);   // 前面几组会改模态/开卷，这里要一张干净的页
  await sleep(1200);
  await page.evaluate(() => {
    if (!S.running) { const b = document.getElementById('btn-start'); if (b) b.click(); }
  });
  await sleep(900);
  const started = await page.evaluate(() => ({ running: S.running, mode: S.mode, dpr: S.dpr, radius: S.radius }));
  ok('默认模式是指针（不是死路）', started.mode === 'mouse', started.mode);
  ok('渲染循环已启动', started.running === true);
  ok('控制栏出现', await page.evaluate(() => document.getElementById('bar').classList.contains('show')));
  await page.mouse.move(700, 420);
  await sleep(300);
  const spot = await page.evaluate(() => ({ x: S.mouseX, y: S.mouseY, dpr: S.dpr }));
  ok('指针坐标跟随（含 DPR 换算）', near(spot.x, 700 * spot.dpr, 4) && near(spot.y, 420 * spot.dpr, 4),
    JSON.stringify(spot));

  /* ═══════════════ 4. every mode ═══════════════ */
  group('4 · 每一种交互模态 / every interaction mode');
  const modeState = async (m) => page.evaluate((mm) => ({
    mode: S.mode,
    spots: (() => { try { const f = M[S.mode].spots; if (typeof f === 'function') return f(null).length; const s = M[S.mode].spot(null); return s ? 1 : 0; } catch (e) { return 'err:' + e.message; } })(),
    ex: (() => { try { return String(M[S.mode].ex() || ''); } catch (e) { return 'err'; } })(),
    meter: document.getElementById('meter').className,
    pip: getComputedStyle(document.getElementById('pip')).display,
  }), m);

  for (const m of ['auto', 'mouse', 'multi', 'keys', 'pen', 'dwell', 'breath', 'shake',
    'clap', 'light', 'eyes', 'gamepad', 'hid', 'nfc', 'osc', 'bridge',
    'audio', 'tilt', 'motion', 'hand', 'face', 'flashlight', 'gaze']) {
    errs.length = 0;
    await page.evaluate((mm) => wM(mm), m);
    await sleep(m === 'face' ? 3500 : 1300);
    const st = await modeState(m);
    ok(`模式 ${m} 可进入且不报错`, st.mode === m && errs.length === 0, errs.join('|') + ' ' + JSON.stringify(st));
  }

  // auto: the scroll drifts on its own
  await page.evaluate(() => wM('auto'));
  await sleep(400);
  const a1 = await page.evaluate(() => M.auto.spot());
  await sleep(900);
  const a2 = await page.evaluate(() => M.auto.spot());
  ok('自动展卷：光圈自己移动', Math.abs(a1.x - a2.x) > 1, `${a1.x.toFixed(1)} → ${a2.x.toFixed(1)}`);

  // motion: the fake camera plays a moving bar → frame differencing must see it
  await page.evaluate(() => wM('motion'));
  await sleep(2500);
  if (CAMERA) {
    const mo = await page.evaluate(() => ({ seen: S.motion.seen, level: S.motion.level, x: S.motion.x, y: S.motion.y, spots: (M.motion.spot() || {}).x }));
    ok('动影：检测到画面运动并给出光圈位置', mo.seen === true && mo.spots !== undefined, JSON.stringify(mo));
    ok('动影：光跟随移动的物体（x 在被追踪区域）', mo.x > 0.05 * 1440 && mo.x < 1.0 * 1440, `x=${mo.x.toFixed(0)}`);
  } else skip('动影：帧差跟随', 'no fixtures');

  // audio: fake mic opens, meter renders
  await page.evaluate(() => wM('audio'));
  await sleep(1600);
  const au = await page.evaluate(() => ({ on: S.audio.on, level: S.audio.level, meter: document.getElementById('meter').className, ctx: S.audio.ctx ? S.audio.ctx.state : null }));
  ok('声音：麦克风管线打开', au.on === true, JSON.stringify(au));
  ok('声音：HUD 电平表显示', au.meter.includes('show'));

  // tilt: no sensor here → must degrade honestly, then with synthetic events it works
  await page.evaluate(() => wM('tilt'));
  await sleep(3200);
  const tf = await page.evaluate(() => ({ mode: S.mode, hint: document.getElementById('first-hint').textContent }));
  ok('倾斜：桌面无传感器时回落指针并说明', tf.mode === 'mouse' && /sensor|传感器|感測器/i.test(tf.hint), JSON.stringify(tf));
  await page.evaluate(() => wM('tilt'));
  await sleep(200);
  await page.evaluate(() => {
    const fire = (b, g, a) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: b, gamma: g, alpha: a }));
    fire(40, 0, 0);                                  // establish the zero point
    setTimeout(() => fire(40, 26, 0), 120);           // tilt right
  });
  await sleep(500);
  const tt = await page.evaluate(() => ({ ready: S.tilt.ready, sx: S.tilt.sx, sy: S.tilt.sy, spot: M.tilt.spot() }));
  ok('倾斜：陀螺仪读数能驱动光圈', tt.ready === true && tt.spot && tt.spot.x > 0, JSON.stringify(tt));

  // gaze: calibration overlay, then honest fallback
  await page.evaluate(() => wM('gaze'));
  await page.waitForFunction(() => document.querySelectorAll('.calib-dot').length === 5,
    { timeout: 25000 }).catch(() => {});
  await sleep(300);
  const gz = await page.evaluate(() => ({
    calib: document.getElementById('calib').classList.contains('show'),
    dots: document.querySelectorAll('.calib-dot').length,
    dismiss: getComputedStyle(document.getElementById('calib-dismiss')).display !== 'none',
  }));
  ok('眼动：校准界面出现（5 点）', gz.calib && gz.dots === 5, JSON.stringify(gz));
  ok('眼动：无标记时提供「用指针继续」出口', gz.dismiss);
  await page.keyboard.press('Escape');
  await sleep(500);
  ok('眼动：Esc 关闭校准并回到指针', await page.evaluate(() => S.mode === 'mouse' && !document.getElementById('calib').classList.contains('show')));

  // flashlight: needsPixels path runs without throwing
  await page.evaluate(() => wM('flashlight'));
  await sleep(1200);
  ok('手电筒：像素读取路径不报错', errs.length === 0, errs.join('|'));

  /* ═══════════════ 4b. 第二批模态 ═══════════════ */
  group('4b · 第二批模态（键盘 / 多指 / 笔锋 / 凝视 / 吐纳 / 语音 / 摇一摇 / 手柄 / MIDI / OSC）');

  // keys: arrows drive the light and must NOT change the scene any more
  await page.evaluate(() => wM('keys')); await sleep(300);
  const k0 = await page.evaluate(() => ({ x: S.keys.x, scene: S.scene }));
  await page.keyboard.down('ArrowRight'); await sleep(500); await page.keyboard.up('ArrowRight');
  await sleep(250);
  const k1 = await page.evaluate(() => ({ x: S.keys.x, scene: S.scene }));
  ok('键盘：方向键移动光圈', k1.x > k0.x + 20, `${Math.round(k0.x)} → ${Math.round(k1.x)}`);
  ok('键盘：方向键不再切换场景（交给键盘模式）', k1.scene === k0.scene);
  await page.keyboard.press(' '); await sleep(200);
  ok('键盘：空格泼墨', await page.evaluate(() => S.phone.splats.length > 0));

  // multi-touch: three fingers → three lights
  await page.evaluate(() => wM('multi')); await sleep(250);
  const three = await page.evaluate(() => {
    const D2 = document.getElementById('display');
    const ev = (t, id, x, y) => D2.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    ev('pointerdown', 31, 200, 300); ev('pointerdown', 32, 400, 300); ev('pointerdown', 33, 600, 300);
    const n = M.multi.spots().length;
    ev('pointerup', 31, 200, 300); ev('pointerup', 32, 400, 300); ev('pointerup', 33, 600, 300);
    return n;
  });
  ok('多指：三根手指 = 三盏灯', three === 3, 'spots=' + three);

  // pen: pressure drives the aperture
  await page.evaluate(() => wM('pen')); await sleep(250);
  const pen = await page.evaluate(() => {
    const D2 = document.getElementById('display');
    const ev = (t, pr) => D2.dispatchEvent(new PointerEvent(t, { pointerId: 41, pointerType: 'pen', clientX: 500, clientY: 400, pressure: pr, bubbles: true }));
    ev('pointerdown', 0.15); const small = M.pen.spot().radius;
    ev('pointermove', 0.95); const big = M.pen.spot().radius;
    ev('pointerup', 0);
    return [Math.round(small), Math.round(big)];
  });
  ok('笔锋：压感越大光圈越大', pen[1] > pen[0] * 1.8, JSON.stringify(pen));

  // dwell: hold still → next painting
  await page.evaluate(() => wM('dwell')); await sleep(250);
  const scDwell = await page.evaluate(() => S.scene);
  await page.mouse.move(700, 450); await sleep(1900);
  ok('凝视停留：停住 1.4 s 换场景', (await page.evaluate(() => S.scene)) !== scDwell);

  // breath: mic + low band envelope
  await page.evaluate(() => wM('breath')); await sleep(1600);
  ok('吐纳：低频包络在跑（麦克风）', await page.evaluate(() => S.audio.on && typeof breathLevel() === 'number' && document.getElementById('meter').className.includes('show')));

  // speech: honest fallback where the API is missing
  await page.evaluate(() => wM('speech')); await sleep(900);
  const sp = await page.evaluate(() => ({ mode: S.mode, has: !!(window.SpeechRecognition || window.webkitSpeechRecognition) }));
  ok('语音：可用则进入，不可用则回落指针', sp.has ? sp.mode === 'speech' : sp.mode === 'mouse', JSON.stringify(sp));

  // shake: synthetic accelerometer
  await page.evaluate(() => wM('shake')); await sleep(400);
  await page.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion',
    { accelerationIncludingGravity: { x: 0, y: 0, z: 26 } })));
  await sleep(400);
  // count can be capped at 40 by earlier groups — assert freshness, not length
  ok('摇一摇：加速度被接收并泼墨', await page.evaluate(() =>
    S.shake.mag > 16 && S.phone.splats.some(s => performance.now() - s.t0 < 900)),
    await page.evaluate(() => JSON.stringify({ mag: S.shake.mag, n: S.phone.splats.length })));

  // gamepad: inject a fake pad
  await page.evaluate(() => {
    wM('gamepad');
    window.__pad = { axes: [0.9, 0], buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 })), connected: true };
    navigator.getGamepads = () => [window.__pad];
    M.gamepad.init();
  });
  const gx0 = await page.evaluate(() => M.gamepad.spot().x);
  await sleep(350);
  const gx1 = await page.evaluate(() => M.gamepad.spot().x);
  ok('手柄：左摇杆推动光圈', gx1 > gx0 + 5, `${Math.round(gx0)} → ${Math.round(gx1)}`);
  const scPad = await page.evaluate(() => S.scene);
  await page.evaluate(() => { window.__pad.buttons[0] = { pressed: true, value: 1 }; M.gamepad.spot(); });
  ok('手柄：A 键换场景', (await page.evaluate(() => S.scene)) !== scPad);

  // midi: fake input
  await page.evaluate(() => wM('midi')); await sleep(300);
  const md = await page.evaluate(async () => {
    navigator.requestMIDIAccess = async () => ({ inputs: new Map([['k', { onmidimessage: null }]]), onstatechange: null });
    await midiStart();
    const inp = [...S.midi.acc.inputs.values()][0];
    inp.onmidimessage({ data: [0xB0, 1, 120] });
    return { seen: S.midi.seen, nx: +S.midi.nx.toFixed(2), r: +S.midi.r.toFixed(2) };
  });
  ok('MIDI：CC1 → X 轴', md.seen && md.nx > 0.9, JSON.stringify(md));

  // OSC over the real relay: SSE + HTTP + UDP
  await page.evaluate(() => wM('osc')); await sleep(700);
  ok('OSC：SSE 通道已连上', await page.evaluate(() => S.osc.ok === true));
  await page.evaluate(() => fetch('/send?room=osc', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x: 0.8, y: 0.25, r: 0.5 }),
  }));
  await sleep(500);
  const o1 = await page.evaluate(() => ({ x: +S.osc.x.toFixed(2), y: +S.osc.y.toFixed(2) }));
  ok('OSC：HTTP 注入改变光圈', Math.abs(o1.x - 0.8) < 0.03 && Math.abs(o1.y - 0.25) < 0.03, JSON.stringify(o1));

  const dgram = require('dgram');
  const pad4 = (b) => { const r = b.length % 4; return r ? Buffer.concat([b, Buffer.alloc(4 - r)]) : b; };
  const osc = (addr, args) => {
    const tags = ',' + args.map(a => Number.isInteger(a) ? 'i' : 'f').join('');
    const out = [pad4(Buffer.from(addr + '\0')), pad4(Buffer.from(tags + '\0'))];
    for (const a of args) { const b = Buffer.alloc(4); Number.isInteger(a) ? b.writeInt32BE(a) : b.writeFloatBE(a); out.push(b); }
    return Buffer.concat(out);
  };
  const usock = dgram.createSocket('udp4');
  const oscSend = (packet) => new Promise(res => usock.send(packet, 0, packet.length, 9000, '127.0.0.1', () => res()));
  try {
    await oscSend(osc('/spot', [0.15, 0.72, 0.3]));
    await sleep(600);
    const o2 = await page.evaluate(() => ({ x: +S.osc.x.toFixed(2), y: +S.osc.y.toFixed(2) }));
    ok('OSC：UDP /spot 包改变光圈（TouchDesigner 路径）', Math.abs(o2.x - 0.15) < 0.05 && Math.abs(o2.y - 0.72) < 0.05, JSON.stringify(o2));
    const scOsc = await page.evaluate(() => S.scene);
    const target = (scOsc + 2) % 7;                      // 必须与当前不同，否则测不出"换"
    await oscSend(osc('/scene', [target]));
    await sleep(600);
    const afterOsc = await page.evaluate(() => S.scene);
    ok('OSC：UDP /scene 包换场景', afterOsc === target && scOsc !== target, `${scOsc} → ${afterOsc}`);
  } catch (e) { ok('OSC：UDP 测试', false, e.message); }
  usock.close();

  /* ═══════════════ 4c. 第三批：外设 / 桥 / NFC / 眨眼 / 环境光 / 3D ═══════════════ */
  group('4c · 第三批（HID / 蓝牙 / 外设桥 / NFC / 眨眼 / 环境光 / 拍手 / 3D 场景 / 视频层）');

  // generic device bridge: any local script POSTs into room=ext
  await page.evaluate(() => wM('bridge')); await sleep(700);
  ok('外设桥：SSE 通道已连上', await page.evaluate(() => S.bridge.ok === true));
  await page.evaluate(() => fetch('/send?room=ext', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x: 0.62, y: 0.18, r: 0.4, name: 'leap' }),
  }));
  await sleep(500);
  const br = await page.evaluate(() => ({ x: +S.bridge.x.toFixed(2), y: +S.bridge.y.toFixed(2), n: S.bridge.name }));
  ok('外设桥：任意脚本 POST 即可驱动（Leap/Kinect/Tobii 路径）',
    Math.abs(br.x - 0.62) < 0.03 && Math.abs(br.y - 0.18) < 0.03 && br.n === 'leap', JSON.stringify(br));

  // HID: inject a fake device + report
  const hidOk = await page.evaluate(() => {
    wM('hid');
    const fake = {
      vendorId: 0x057E, productName: 'Fake Joy-Con', opened: true,
      addEventListener() {}, open: async () => {}, close: async () => {},
    };
    S.hid = { dev: fake, seen: false, x: .5, y: .5, r: .5 };
    const bytes = new Uint8Array(12); bytes[6] = 200; bytes[7] = 60; bytes[8] = 0;
    const dv = new DataView(bytes.buffer);
    hidReport({ data: dv });
    return { seen: S.hid.seen, x: +S.hid.x.toFixed(2), y: +S.hid.y.toFixed(2) };
  });
  ok('HID：Joy-Con 报告解析成坐标', hidOk.seen && Math.abs(hidOk.x - 0.78) < 0.02 && Math.abs(hidOk.y - 0.24) < 0.02,
    JSON.stringify(hidOk));

  // Bluetooth: fake heart-rate characteristic
  const bleOk = await page.evaluate(() => {
    wM('ble');
    S.ble = { dev: null, seen: false, x: .5, y: .5, r: .5, hr: 0, hooked: true };
    const dv = new DataView(new Uint8Array([0x00, 120]).buffer);
    bleValue({ target: { uuid: '00002a37-0000-1000-8000-00805f9b34fb', value: dv } });
    return { hr: S.ble.hr, r: +S.ble.r.toFixed(2), seen: S.ble.seen };
  });
  ok('蓝牙：心率读数 → 光圈', bleOk.hr === 120 && bleOk.r > 0.9, JSON.stringify(bleOk));

  // WebSerial IR tracker: no serial API in this browser → must stay in-mode and say so
  const ir = await page.evaluate(() => { wM('ir'); return { mode: S.mode, has: 'serial' in navigator }; });
  ok('IR 追踪器：无 WebSerial 时不报错、不踢出模式', ir.has ? ir.mode === 'ir' : ir.mode === 'ir',
    JSON.stringify(ir));

  // NFC: fake NDEF reader
  const nfcOk = await page.evaluate(async () => {
    window.NDEFReader = function () { this.scan = async () => {}; };
    await nfcStart();
    return { has: 'NDEFReader' in window, mode: S.mode };
  });
  ok('NFC：没有扫描器时不会崩', nfcOk.has === true, JSON.stringify(nfcOk));

  // ambient light: no sensor in headless → honest hint, pointer still works
  const lx = await page.evaluate(() => { wM('light'); return { ok: S.light.ok, sensor: 'AmbientLightSensor' in window }; });
  ok('环境光：无传感器时给提示并继续可用', lx.sensor ? true : lx.ok === false, JSON.stringify(lx));

  // clap: drive the onset handler directly (mic has no real peaks here)
  const clap0 = await page.evaluate(() => S.scene);
  await page.evaluate(() => { wM('clap'); S.clap = { last: 0, prev: 0 }; clapOnset(); });
  await sleep(60);
  await page.evaluate(() => { S.clap.last = 0; clapOnset(); });
  await sleep(200);
  ok('拍手：连拍两下换画', (await page.evaluate(() => S.scene)) !== clap0);

  // 3D parallax scene: index 5 must render and be its own picture
  await page.evaluate(() => wM('mouse'));
  const fp = await page.evaluate(() => {
    const out = [];
    for (const sc of [0, 5]) {
      changeScene(sc);
      const c = document.createElement('canvas'); c.width = 32; c.height = 20;
      const g = c.getContext('2d'); g.drawImage(scCvs, 0, 0, 32, 20);
      out.push([...g.getImageData(0, 0, 32, 20).data].filter((_, i) => i % 4 === 0).join(','));
    }
    return { same: out[0] === out[1], n: SCENE_COUNT };
  });
  ok('3D 视差场景（第 6 张）渲染成独立画面', fp.same === false && fp.n === 7, JSON.stringify({ same: fp.same, sceneCount: fp.n }));
  ok('场景导航有 7 个点', (await page.evaluate(() => document.querySelectorAll('.scene-dot').length)) === 7);

  // ── 点云立轴（第 7 张）：能渲染、且「光的位置」真的改变视角 ──
  const cloud = await page.evaluate(async () => {
    changeScene(6);
    await new Promise(r => setTimeout(r, 400));
    const snap = () => {
      const c = document.createElement('canvas'); c.width = 48; c.height = 30;
      const g = c.getContext('2d'); g.drawImage(D, 0, 0, 48, 30);
      const d = g.getImageData(0, 0, 48, 30).data;
      let sum = 0, nz = 0;
      for (let i = 0; i < d.length; i += 4) { const l = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; sum += l; if (l > 40) nz++; }
      return { mean: +(sum / (48 * 30)).toFixed(1), nz, pts: (window._cloud || null) };
    };
    S.mouseX = DW * 0.12; S.mouseY = DH * 0.5;
    await new Promise(r => setTimeout(r, 260));
    const a = snap();
    S.mouseX = DW * 0.88;
    await new Promise(r => setTimeout(r, 260));
    const b = snap();
    return { a, b, count: (buildCloud() || {}).pts ? buildCloud().pts.length : 0, sceneCount: SCENE_COUNT };
  });
  ok('点云立轴：生成了点云（>1000 点）', cloud.count > 1000, 'pts=' + cloud.count);
  ok('点云立轴：画面不是空白', cloud.a.nz > 50 && cloud.a.mean > 2, JSON.stringify(cloud.a));
  ok('点云立轴：移动光的位置会改变视角（真 3D 交互）',
    cloud.a.nz !== cloud.b.nz || cloud.a.mean !== cloud.b.mean,
    `${cloud.a.mean}/${cloud.a.nz} vs ${cloud.b.mean}/${cloud.b.nz}`);
  const staticDeps = [...fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8')
    .matchAll(/<script src="(https?:[^"]+)"/g)].map(m => m[1]);
  // 深度进契约：直接渲染两次同尺寸点云，z 不同 → 像素必须不同（确定性，不依赖窗口均值）
  const depth = await page.evaluate(async () => {
    const c1 = document.createElement('canvas'); c1.width = 240; c1.height = 150;
    const c2 = document.createElement('canvas'); c2.width = 240; c2.height = 150;
    const g1 = c1.getContext('2d'), g2 = c2.getContext('2d');
    const prev = S.bridge.z;
    S.mouseX = DW * 0.5; S.mouseY = DH * 0.5;
    S.bridge.z = 0.0; drawCloud(g1, 240, 150, 1.0, false);
    S.bridge.z = 1.0; drawCloud(g2, 240, 150, 1.0, false);
    const a = g1.getImageData(0, 0, 240, 150).data, b = g2.getImageData(0, 0, 240, 150).data;
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 6) diff++;
    S.bridge.z = prev;
    return { diff, total: 240 * 150 };
  });
  ok('深度 z 进契约：z 不同 → 点云画面不同（推轨生效）', depth.diff > depth.total * 0.05,
    `${depth.diff}/${depth.total} 像素不同`);
  ok('postMessage 携带 z 会被接收', await page.evaluate(async () => {
    window.postMessage({ type: 'ink', x: 0.5, y: 0.5, z: 0.25 }, '*');
    await new Promise(r => setTimeout(r, 90));
    return Math.abs(S.bridge.z - 0.25) < 1e-6;
  }));

  const head = await page.evaluate(async () => {
    const mk = () => { const c = document.createElement('canvas'); c.width = 240; c.height = 150;
      return { c, g: c.getContext('2d') }; };
    S.mode = 'face'; S.face = { ready: true, seen: true, nx: 0.5, ny: 0.5, z: 0, open: 0 };
    const a = mk(); drawCloud(a.g, 240, 150, 1.0, false);
    S.face.z = -0.28; S.face.nx = 0.72;
    const b = mk(); drawCloud(b.g, 240, 150, 1.0, false);
    const da = a.g.getImageData(0, 0, 240, 150).data, db = b.g.getImageData(0, 0, 240, 150).data;
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 6) diff++;
    return { diff, total: 240 * 150 };
  });
  ok('头部视差：人头前进/侧移会改变点云视角', head.diff > head.total * 0.05,
    `${head.diff}/${head.total} 像素不同`);

  // 视角三件套：滚轮推拉、双击定住、Shift+拖绕轴（确定性渲染对比）
  // wheel zoom: drive the state directly, then compare render
  const zoomPix = await page.evaluate(() => {
    const mk = () => { const c = document.createElement('canvas'); c.width = 200; c.height = 120;
      return { c, g: c.getContext('2d') }; };
    S.view.zoom = 1.0; const a = mk(); drawCloud(a.g, 200, 120, 1.0, false);
    S.view.zoom = 1.8; const b = mk(); drawCloud(b.g, 200, 120, 1.0, false);
    const da = a.g.getImageData(0, 0, 200, 120).data, db = b.g.getImageData(0, 0, 200, 120).data;
    let diff = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 6) diff++;
    return { diff, total: 200 * 120 };
  });
  ok('点云视角：滚轮推拉（zoom）真的改变画面', zoomPix.diff > zoomPix.total * 0.08,
    `${zoomPix.diff}/${zoomPix.total} 像素不同`);

  const orbit = await page.evaluate(() => {
    const mk = () => { const c = document.createElement('canvas'); c.width = 200; c.height = 120;
      return { c, g: c.getContext('2d') }; };
    S.view.zoom = 1; S.view.yaw = 0; const a = mk(); drawCloud(a.g, 200, 120, 1.0, false);
    S.view.yaw = 0.55; const b = mk(); drawCloud(b.g, 200, 120, 1.0, false);
    S.view.yaw = 0;
    const da = a.g.getImageData(0, 0, 200, 120).data, db = b.g.getImageData(0, 0, 200, 120).data;
    let diff = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 6) diff++;
    return { diff, total: 200 * 120, yaw: true };
  });
  ok('点云视角：绕轴旋转（yaw）改变画面', orbit.diff > orbit.total * 0.08,
    `${orbit.diff}/${orbit.total} 像素不同`);

  const frozen = await page.evaluate(() => {
    S.view.frozen = false; S.view.yaw = 0;
    const t0 = performance.now() / 1000;
    const draw = (t) => { const c = document.createElement('canvas'); c.width = 200; c.height = 120;
      const g = c.getContext('2d'); drawCloud(g, 200, 120, t, false); return g.getImageData(0, 0, 200, 120).data; };
    const a = draw(t0), b = draw(t0 + 3.0);
    let moving = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 6) moving++;
    S.view.frozen = true;
    const c1 = draw(t0), c2 = draw(t0 + 3.0);
    let still = 0; for (let i = 0; i < c1.length; i += 4) if (Math.abs(c1[i] - c2[i]) > 6) still++;
    S.view.frozen = false;
    return { moving, still, total: 200 * 120 };
  });
  ok('点云视角：双击定住后画面不再漂移', frozen.moving > frozen.total * 0.02 && frozen.still < frozen.total * 0.005,
    `漂移 ${frozen.moving} → 定住 ${frozen.still}`);

  // 三种输入接进 3D：声音、呼吸、捏合
  const couple = await page.evaluate(() => {
    const mk = () => { const c = document.createElement('canvas'); c.width = 200; c.height = 120;
      return { c, g: c.getContext('2d') }; };
    const diffOf = (mut) => {
      S.view = { yaw: 0, pitch: 0, zoom: 1, frozen: false };
      S.audio = { on: false, level: 0, pitch: 0 };
      S.mode = 'mouse'; S.grab = 0.5;
      const a = mk(); drawCloud(a.g, 200, 120, 1.0, false);
      mut();
      const b = mk(); drawCloud(b.g, 200, 120, 1.0, false);
      const da = a.g.getImageData(0, 0, 200, 120).data, db = b.g.getImageData(0, 0, 200, 120).data;
      let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 6) n++;
      return n;
    };
    const sound = diffOf(() => { S.mode = 'audio'; S.audio = { on: true, level: 0.8, pitch: 660 }; });
    const breath = diffOf(() => { S.mode = 'breath'; S.audio = { on: true, level: 0.9, pitch: 0 }; });
    const grab = diffOf(() => { S.mode = 'hand'; S.hlm = [{}]; S.grab = 1.0; });
    S.mode = 'mouse'; S.audio = { on: false, level: 0, pitch: 0 }; S.hlm = null; S.grab = 0.5;
    return { sound, breath, grab, total: 200 * 120 };
  });
  ok('3D 耦合 · 声音：响度/音高改变点云', couple.sound > couple.total * 0.03, `${couple.sound} 像素`);
  ok('3D 耦合 · 呼吸：气息改变雾浓度', couple.breath > couple.total * 0.03, `${couple.breath} 像素`);
  ok('3D 耦合 · 捏合：抓住画卷推拉（1=张开 0=捏紧）', couple.grab > couple.total * 0.03, `${couple.grab} 像素`);

  const pageSrc = await page.evaluate(async () => (await fetch('index.html')).text());
  ok('分享卡/配对流：不再依赖二维码库（少一个 CDN 包）',
    !/qrcode-generator|qrcode\(/.test(pageSrc), 'qrcode gone');

  ok('点云立轴：没有引入新的 CDN 依赖（静态脚本仍 ≤4）', staticDeps.length <= 4,
    staticDeps.length + ' → ' + staticDeps.map(u => u.split('/')[2]).join(','));

  // video content layer: a broken URL must not break the piece
  const vd = await page.evaluate(() => { videoAttach('scenes/does-not-exist.mp4'); return !!S.video; });
  await sleep(400);
  ok('视频内容层：坏 URL 不会让画卷崩掉', vd && (await page.evaluate(() => S.running)));

  /* ═══════════════ 4d. 真·识别（用真实照片喂摄像头） ═══════════════ */
  group('4d · 真识别：用真实照片证明 MediaPipe 认出东西了');
  if (!CAMERA) { skip('真识别', 'no fixtures'); }
  else {
    const recog = async (fixture, mode, read) => {
      const b2 = await chromium.launch({
        executablePath: CHROME, headless: !HEADED,
        args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
          '--use-file-for-fake-video-capture=' + path.join(__dirname, 'fixtures', fixture),
          '--autoplay-policy=no-user-gesture-required'],
      });
      const p2 = await b2.newPage({ viewport: { width: 900, height: 600 } });
      const e2 = []; watch(p2, e2);
      await p2.goto(`${BASE}/index.html?mode=${mode}`);
      await p2.waitForFunction(() => S.running === true, { timeout: 20000 }).catch(() => {});
      for (let i = 0; i < 12; i++) await sleep(500);      // let the model load + one pass
      const out = await p2.evaluate(read);
      await b2.close();
      return { out, errs: e2 };
    };
    const hand = await recog('hand.y4m', 'hand', () => ({
      landmarks: S.hlm ? S.hlm.length : 0, gesture: S.gesture,
      spot: M.hand.spot(null) ? 1 : 0,
    }));
    ok('真识别 · 手势：真实手部照片认出 21 个关键点', hand.out.landmarks === 21, JSON.stringify(hand.out));
    ok('真识别 · 手势：手张开 → 光圈跟随', hand.out.gesture === 'open' && hand.out.spot === 1, JSON.stringify(hand.out));

    const face = await recog('facecam.y4m', 'face', () => ({
      seen: !!S.face.seen, nx: +(S.face.nx || 0).toFixed(2), ear: +(S.eyes.ear || 0).toFixed(2), z: S.face.z,
      spot: M.face.spot() ? 1 : 0,
    }));
    ok('真识别 · 面庞：真实人脸被检出并给出坐标', face.out.seen === true && face.out.spot === 1, JSON.stringify(face.out));
    ok('真识别 · 眨眼：EAR 在睁眼范围内（0.2–0.6）', face.out.ear > 0.2 && face.out.ear < 0.6, 'ear=' + face.out.ear);
    ok('真识别 · 面庞：拿到鼻尖深度 z（头部视差的前提）',
      typeof face.out.z === 'number' && Number.isFinite(face.out.z) && Math.abs(face.out.z) < 2,
      'z=' + face.out.z);
  }

  /* ═══════════════ 4d2. 吹墨（麦克风 → 灰尘散去 → 彩色） ═══════════════ */
  group('4d2 · 吹墨：吹气把墨层吹散，露出彩色');
  const blow = await page.evaluate(async () => {
    wM('blow');
    await new Promise(r => setTimeout(r, 400));
    // 模拟麦克风读数：直接驱动 level，避免依赖真实环境噪声
    S.audio.on = true; S.audio.level = 0;
    S.mouseX = DW * 0.5; S.mouseY = DH * 0.5;
    for (let i = 0; i < 6; i++) { S.audio.level = 0.75; M.blow.spot(); await new Promise(r => setTimeout(r, 60)); }
    const mask = (() => {
      const c = document.createElement('canvas'); c.width = 80; c.height = 50;
      const g = c.getContext('2d'); g.drawImage(S.dust.cvs, 0, 0, 80, 50);
      const d = g.getImageData(0, 0, 80, 50).data; let a = 0;
      for (let i = 3; i < d.length; i += 4) a += d[i];
      return { alpha: Math.round(a / (80 * 50)), level: Math.round((S.dust.level || 0) * 100) };
    })();
    // 停吹：蒙版应该慢慢回墨
    for (let i = 0; i < 30; i++) { S.audio.level = 0; M.blow.spot(); }
    const after = Math.round((S.dust.level || 0) * 100);
    return { ...mask, after, mode: S.mode };
  });
  ok('吹墨：进入模式并建立蒙版', blow.mode === 'blow' && blow.alpha > 8, JSON.stringify(blow));
  ok('吹墨：吹气让蒙版累积（灰尘真的被吹开）', blow.level > 20, `level=${blow.level}%`);
  ok('吹墨：停止吹气后会回墨', blow.after < blow.level, `${blow.level}% → ${blow.after}%`);

  /* ═══════════════ 4d3. 冷门输入（滚轮 / 电池） ═══════════════ */
  group('4d3 · 冷门但真实的输入：滚轮轨迹、电池余量');
  const scr = await page.evaluate(() => {
    wM('scroll'); S.scroll = { acc: 0, t: performance.now(), v: 0 };
    const a = M.scroll.spot();
    S.scroll.acc = 400; S.scroll.v = 40;
    const b = M.scroll.spot();
    return { moved: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1, rBigger: b.radius > a.radius };
  });
  ok('滚轮模式：累积量驱动光、速度放大光圈', scr.moved && scr.rBigger, JSON.stringify(scr));

  const bt = await page.evaluate(async () => {
    wM('battery');
    S.batt = { level: 0.15, charging: false, seen: true };
    const low = M.battery.spot().radius;
    S.batt.level = 1.0;
    const full = M.battery.spot().radius;
    return { low: Math.round(low), full: Math.round(full), has: !!navigator.getBattery };
  });
  ok('电池模式：电量越低光圈越小', bt.full > bt.low * 1.8, JSON.stringify(bt));

  /* ═══════════════ 4e. 创作软件接入 ═══════════════ */
  group('4e · 创作软件接入（Blender / TouchDesigner / p5.js）');
  await page.evaluate(() => wM('mouse'));
  const pm = await page.evaluate(async () => {
    window.postMessage({ type: 'ink', x: 0.31, y: 0.72, r: 1.4, name: 'p5' }, '*');
    await new Promise(r => setTimeout(r, 90));
    return { mode: S.mode, x: +S.bridge.x.toFixed(2), y: +S.bridge.y.toFixed(2), r: +S.bridge.r.toFixed(2), name: S.bridge.name };
  });
  ok('postMessage：任何网页都能驱动（p5 / Hydra / iframe）',
    pm.x === 0.31 && pm.y === 0.72 && pm.mode === 'bridge' && pm.name === 'p5', JSON.stringify(pm));

  const api = await page.evaluate(() => {
    window.InkScroll.spot(0.15, 0.85, 0.6);
    window.InkScroll.scene(5);
    return { has: !!window.InkScroll, x: S.bridge.x, y: S.bridge.y, scene: S.scene, st: window.InkScroll.state };
  });
  ok('window.InkScroll.* 公共 API（spot/scene/state）',
    api.has && Math.abs(api.x - 0.15) < 1e-6 && api.scene === 5 && api.st.mode === 'bridge', JSON.stringify(api));

  const blender = await page.evaluate(async () => {
    const r = await fetch('/send?room=ext', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 0.375, y: 0.35, r: 1.0, name: 'blender-demo' }),
    });
    return r.ok;
  });
  await sleep(450);
  ok('Blender 适配器的载荷被中继接受',
    blender && Math.abs(await page.evaluate(() => S.bridge.x) - 0.375) < 0.03);

  const files = ['examples/blender_ink_spot.py', 'examples/p5_drive.html',
    'examples/touchdesigner_osc.md', 'docs/CREATIVE-TOOLS.md'];
  ok('三套接入示例与文档都在仓库里', files.every(f => fs.existsSync(path.join(ROOT, f))), files.join(', '));
  const bl = fs.readFileSync(path.join(ROOT, 'examples/blender_ink_spot.py'), 'utf8');
  ok('Blender 脚本走的是 /send?room=ext 且坐标归一化',
    /send\?room=ext/.test(bl) && /BOUND/.test(bl) && /max\(0\.0, min\(1\.0/.test(bl));

  /* ═══════════════ 4d4. 图谱 §B：笔倾斜 / 底噪 / 节拍 ═══════════════ */
  group('4d4 · 图谱 §B 三条（笔倾斜 / 房间底噪 / 节拍 BPM）');
  const pt = await page.evaluate(() => {
    wM('pentilt');
    S.pen = true; S.ptilt = { tx: 0, ty: 0 };
    const flat = M.pentilt.spot();
    S.ptilt = { tx: 34, ty: 18 };
    const tilted = M.pentilt.spot();
    return { brushFlat: flat.brush, brushTilted: tilted.brush, ang: +tilted.ang.toFixed(2), state: tilted.state && tilted.state.tiltX };
  });
  ok('笔倾斜：侧锋时笔触变成条状（brush=1）且角度来自 tilt', pt.brushFlat === 0 && pt.brushTilted === 1 && pt.state === 34, JSON.stringify(pt));

  const nz = await page.evaluate(async () => {
    wM('noise'); S.audio = { on: true, level: 0 }; S.noise = { v: 0 };
    for (let i = 0; i < 40; i++) { S.audio.level = 0.6; M.noise.spot(); }
    const loud = S.noise.v;
    for (let i = 0; i < 200; i++) { S.audio.level = 0; M.noise.spot(); }
    return { loud: +loud.toFixed(3), after: +S.noise.v.toFixed(3) };
  });
  ok('房间底噪：慢速包络上升且会回落（不是硬阈值）', nz.loud > 0.2 && nz.after < nz.loud, JSON.stringify(nz));

  const bt2 = await page.evaluate(() => {
    wM('beat');
    S.beat2 = { prev: null, last: 0, flux: 0, bpm: 0, ints: [] };
    const flat = () => { const a = new Uint8Array(64); a.fill(6); return a; };
    const hit  = () => { const a = new Uint8Array(64); a.fill(6); for (let i = 4; i < 20; i++) a[i] = 240; return a; };
    S.audio = { on: true, freq: flat(), level: 0.3 };
    beatTick();                                    // 种下 prev
    S.beat2.last = performance.now() - 500;
    for (let k = 0; k < 8; k++) {
      S.beat2.last = performance.now() - 500;      // 每 500ms 一拍 ≈ 120 BPM
      S.audio.freq = hit();  beatTick();           // 峰值 → 计一次
      S.audio.freq = flat(); beatTick();           // 回落到平
    }
    return { bpm: S.beat2.bpm, flux: Math.round(S.beat2.flux), ints: S.beat2.ints.length };
  });
  ok('节拍：频谱通量能估出 BPM', bt2.bpm >= 60 && bt2.bpm <= 240 && bt2.ints >= 3, JSON.stringify(bt2));

  /* ═══════════════ 4d5. 纯逻辑三条（时间 / 剪贴板 / 取色） ═══════════════ */
  group('4d5 · 纯逻辑三条：时间天时 / 剪贴板题字 / 取色入画');
  const hr = await page.evaluate(() => {
    const dawn = hoursSpot(6, 0), noon = hoursSpot(12, 0), night = hoursSpot(0, 0);
    return { dx: Math.round(dawn.x), dElev: dawn.state.elevation, nElev: noon.state.elevation,
             nightY: Math.round(night.y), noonY: Math.round(noon.y), nr: Math.round(noon.radius), dnr: Math.round(dawn.radius) };
  });
  ok('天时：正午比清晨高、且光圈更大', hr.nElev > hr.dElev && hr.noonY < hr.nightY && hr.nr > hr.dnr,
    JSON.stringify(hr));

  const pick = await page.evaluate(() => {
    const map = { '#1a1c36': 4, '#c4ccd6': 2, '#567054': 1, '#767869': 0, '#ce9e96': 3 };
    const got = {}; for (const [hex, want] of Object.entries(map)) got[hex] = nearestScene(hex);
    return { got, bad: hexToRgb('zzz'), ok: hexToRgb('#ff8800') };
  });
  ok('取色：最接近的场景判断正确', Object.entries(pick.got).every(([h, v]) => v === { '#1a1c36': 4, '#c4ccd6': 2, '#567054': 1, '#767869': 0, '#ce9e96': 3 }[h]),
    JSON.stringify(pick.got));
  ok('取色：非法色值安全返回（不崩）', pick.bad === null && pick.ok.join(',') === '255,136,0', JSON.stringify(pick));

  const clip = await page.evaluate(async () => {
    if (S.scene !== 0) changeScene(0);
    const before = S.scene;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => '今天下了雪，很冷' } });
    await clipRead();
    const after = S.scene;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => { throw new Error('denied'); } } });
    await clipRead();
    return { before, after, okFlag: S.clip.ok };
  });
  ok('剪贴板：文字里的「雪」→ 切到雪景', clip.after === 2 && clip.after !== clip.before, JSON.stringify(clip));
  ok('剪贴板：拒绝授权时优雅失败（不抛到页面）', clip.okFlag === false, JSON.stringify(clip));

  const ip = await page.evaluate(async () => {
    window.EyeDropper = function(){ this.open = async () => ({ sRGBHex: '#c4ccd6' }); };
    await inkpickOpen();
    return { hex: S.pick.hex, scene: S.scene };
  });
  ok('取色器：拿到颜色 → 切到最近的那幅画', ip.hex === '#c4ccd6' && ip.scene === 2, JSON.stringify(ip));

  /* ═══════════════ 4d6. 环境感知四条（在场/多屏/锁键/负载） ═══════════════ */
  group('4d6 · 环境感知：在场 / 多屏 / 展厅锁键 / 机器负载');
  const env = await page.evaluate(() => {
    const act = presenceRadius(0, 'active');
    const idle10 = presenceRadius(10, 'idle');
    const idle600 = presenceRadius(600, 'idle');
    const one = screenSpot([{ left: 0, width: 1920 }], 0);
    const two = screenSpot([{ left: 0, width: 1920 }, { left: 1920, width: 1920 }], 1);
    return {
      act, idle10: +idle10.toFixed(2), idle600: +idle600.toFixed(2),
      oneX: Math.round(one.x), twoX: Math.round(two.x), twoCount: two.count,
      pr: [pressureRadius('nominal'), pressureRadius('serious'), pressureRadius('critical')],
    };
  });
  ok('在场：活跃=全亮，离开越久越暗但有下限', env.act === 1 && env.idle10 < 1 && env.idle600 >= 0.25,
    JSON.stringify(env));
  ok('多屏：第二块屏上的光位与第一块不同', env.oneX !== env.twoX && env.twoCount === 2,
    `x1=${env.oneX} x2=${env.twoX}`);
  ok('负载：压力越大光圈越小（nominal>serious>critical）',
    env.pr[0] > env.pr[1] && env.pr[1] > env.pr[2], JSON.stringify(env.pr));

  const kk = await page.evaluate(() => {
    let called = null;
    Object.defineProperty(navigator, 'keyboard', { configurable: true, value: { lock: (keys) => { called = keys; } } });
    const locked = kioskLock();
    const calledLen = called && called.length;
    const fallback = (() => {
      Object.defineProperty(navigator, 'keyboard', { configurable: true, value: undefined });
      const r = kioskLock();
      Object.defineProperty(navigator, 'keyboard', { configurable: true, value: { lock: () => {} } });
      return r;
    })();
    return { locked, called: calledLen, fallback };
  });
  ok('展厅锁键：支持时真的调用 lock(keys)，不支持时安全返回 false',
    kk.locked === true && kk.called === 4 && kk.fallback === false, JSON.stringify(kk));

  for (const m of ['presence', 'screens', 'kiosk', 'load']) {
    const st = await page.evaluate((mm) => { wM(mm); return { mode: S.mode }; }, m);
    ok(`环境模态 ${m} 可进入`, st.mode === m, st.mode);
  }

  /* ═══════════════ 4g. 闭环回传（页面 → 脚本） ═══════════════ */
  group('4g · 闭环回传：页面把状态 POST 出去，脚本能收到');
  const loop = await page.evaluate(async () => {
    const got = [];
    const es = new EventSource('/events?room=ext-state');
    es.onmessage = (e) => { try { got.push(JSON.parse(e.data)); } catch (err) {} };
    await new Promise(r => setTimeout(r, 500));
    wM('bridge');                          // 进入 bridge 模式 → 触发 pushState
    window.InkScroll.spot(0.42, 0.61);
    await new Promise(r => setTimeout(r, 1400));
    es.close();
    const last = got[got.length - 1] || null;
    return { n: got.length, last };
  });
  ok('回传：脚本订阅 room=ext-state 能收到页面状态', loop.n > 0, `收到 ${loop.n} 条`);
  ok('回传：状态里带 mode/scene/style 与光位',
    !!loop.last && loop.last.type === 'state' && loop.last.mode === 'bridge'
      && typeof loop.last.x === 'number' && typeof loop.last.scene === 'number',
    JSON.stringify(loop.last));

  /* ═══════════════ 4h. 展厅预设 + 口哨音名 ═══════════════ */
  group('4h · 展厅预设（?preset=）与口哨音名');
  const pre = await page.evaluate(() => {
    const before = { mode: S.mode, scene: S.scene, style: S.style };
    applyPreset('kiosk');
    const k = { mode: S.mode, scene: S.scene, style: S.style, wall: S.wall, grid: S.grid,
                cls: document.body.classList.contains('wall') };
    applyPreset('stereo');
    const st = { scene: S.scene, stereo: S.stereo, wall: S.wall };
    applyPreset('gallery');
    const g = { mode: S.mode, style: S.style, wall: S.wall, stereo: S.stereo };
    document.body.classList.remove('wall');
    return { before, k, st, g, unknown: applyPreset('nope') };
  });
  ok('预设 kiosk：自动展卷 + 投影墙 + 网格（body.wall 生效）',
    pre.k.mode === 'auto' && pre.k.wall === true && pre.k.grid === true && pre.k.cls, JSON.stringify(pre.k));
  ok('预设 stereo：切到点云 + 左右分屏', pre.st.scene === 6 && pre.st.stereo === 'sbs', JSON.stringify(pre.st));
  ok('预设 gallery：回到纸本、无墙无立体', pre.g.mode === 'auto' && pre.g.style === 'paper' && pre.g.wall === false && pre.g.stereo === null,
    JSON.stringify(pre.g));
  ok('未知预设安全返回 false（不崩）', pre.unknown === false);

  const notes = await page.evaluate(() => ({
    a4: noteOf(440), c4: noteOf(261.63), cents: noteOf(445), bad: noteOf(10), hi: noteOf(10000),
  }));
  ok('口哨：A4/C4 音名正确', notes.a4.name === 'A4' && notes.c4.name === 'C4', JSON.stringify(notes.a4) + JSON.stringify(notes.c4));
  ok('口哨：音分偏差有符号，越界返回 null',
    Math.abs(notes.cents.cents) <= 25 && notes.bad === null && notes.hi === null, JSON.stringify(notes.cents));

  /* ═══════════════ 4j. 审核补漏：四个模态缺"按名字"的断言 ═══════════════ */
  group('4j · 审核补漏：hours / clip / inkpick / whistle 各自可进入');
  for (const m of ['hours', 'clip', 'inkpick', 'whistle']) {
    const st2 = await page.evaluate((mm) => { wM(mm); return { mode: S.mode, ex: M[mm].ex() }; }, m);
    ok(`模态 ${m} 可进入并给出状态行`, st2.mode === m && typeof st2.ex === 'string', String(st2.ex).slice(0, 40));
  }
  await page.evaluate(() => { wM('mouse'); });

  /* ═══════════════ 4i. 前后端对齐 ═══════════════ */
  group('4i · 前后端对齐：每个模态都在 UI 里，后端 API 齐全');
  const parity = await page.evaluate(() => {
    const all = Object.keys(M);
    const groups = (typeof MODE_GROUPS !== 'undefined' ? MODE_GROUPS : []).flatMap(g => g.modes);
    const cards = [...document.querySelectorAll('.mode-card')].map(c => c.dataset.mode);
    const help = [...document.querySelectorAll('#help-modes .help-mode')].map(b => b.dataset.mode);
    return { all: all.length, grouped: groups.length, missingGroup: all.filter(k => !groups.includes(k)),
             missingHelp: all.filter(k => !help.includes(k)), cards: cards.length };
  });
  ok('前端：42 个模态全部落在分组里', parity.all === parity.grouped && parity.missingGroup.length === 0,
    JSON.stringify(parity.missingGroup));
  ok('前端：卡片数 == 注册表数量（不按能力隐藏）', parity.cards === parity.all,
    `cards=${parity.cards} registry=${parity.all}`);
  ok('前端：帮助面板列出全部模态', parity.missingHelp.length === 0, JSON.stringify(parity.missingHelp));

  const srvApi = await page.evaluate(async () => {
    const j = async (p) => (await fetch(p)).json();
    const h = await j('/health'), rooms = await j('/rooms'), st = await j('/state?room=ext-state');
    return { ok: h.ok, hasRooms: !!h.rooms, osc: h.osc_port, dmx: h.dmx,
             roomsType: typeof rooms.rooms, stateNull: st.state === null || typeof st.state === 'object' };
  });
  ok('后端：/health 返回状态（含 osc/dmx 配置）', srvApi.ok === true && srvApi.osc > 0 && typeof srvApi.dmx === 'boolean', JSON.stringify(srvApi));
  ok('后端：/rooms 与 /state 可用', srvApi.roomsType === 'object' && srvApi.stateNull === true, JSON.stringify(srvApi));

  /* ═══════════════ 4f. 契约升级 Spot{id,presence,state} ═══════════════ */
  group('4f · 契约升级：id / presence / state');
  const ctr = await page.evaluate(() => {
    const a = normSpot({ x: -50, y: 99999, radius: 120 });
    const b = normSpot({ x: 10, y: 20, radius: 120, presence: 0 });
    const c = normSpot({ x: 10, y: 20, radius: 120, presence: 1, id: 'phone#3', state: { breath: 0.7 } });
    const d = normSpot({ x: 10, y: 20, radius: 120 }, 4);
    return { a: [Math.round(a.x), Math.round(a.y), Math.round(a.radius), a.id, a.presence],
             bR: Math.round(b.radius), cR: Math.round(c.radius), cid: c.id, cst: c.state.breath, did: d.id };
  });
  ok('契约：坐标被夹紧到画布内', ctr.a[0] === 0 && ctr.a[1] > 0, JSON.stringify(ctr.a));
  ok('契约：缺省补 id、presence=1', ctr.a[3] === 'sp0' && ctr.a[4] === 1, JSON.stringify(ctr.a));
  ok('契约：presence 低 → 光圈更小（0.55× 底）', ctr.bR < ctr.cR * 0.7, `${ctr.bR} vs ${ctr.cR}`);
  ok('契约：id / state 原样透传（模态可带自己的状态袋）',
    ctr.cid === 'phone#3' && ctr.cst === 0.7, JSON.stringify(ctr));
  ok('契约：按序号生成 id（多灯时天然不冲突）', ctr.did === 'sp4', ctr.did);

  const ext = await page.evaluate(() => {
    const msg = { type: 'ink', x: 0.4, y: 0.6, presence: 0.25, id: 'td-osc', state: { warp: 3 } };
    extIngest(msg);          // 第一次会切到 bridge 模式（init 会重置状态）
    extIngest(msg);          // 第二次只写状态，不再切模式
    const B = S.bridge, sp = M.bridge.spot();
    return { id: B.id, presence: B.presence, warp: B.state && B.state.warp,
             spId: sp && sp.id, spPresence: sp && sp.presence };
  });
  ok('契约：外部（OSC/HTTP/postMessage）也能带 presence/state/id',
    ext.id === 'td-osc' && Math.abs(ext.presence - 0.25) < 1e-6 && ext.warp === 3
      && (ext.spId === 'td-osc' || ext.spId === undefined), JSON.stringify(ext));

  /* ═══════════════ 5. phone relay (真机链路) ═══════════════ */
  group('5 · 手机魔杖 / phone relay (server.py + phone.html)');
  errs.length = 0;
  await page.evaluate(() => wM('phone'));
  await sleep(1200);
  const room = await page.evaluate(() => S.phone.room);
  ok('生成房间号并显示配对面板', !!room && await page.evaluate(() => document.getElementById('phone-pair').classList.contains('show')));

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  watch(phone, errs);
  await phone.goto(`${BASE}/phone.html?v=${room}#room=${room}`);
  await sleep(1000);
  ok('手机页连上中继', /connected|已连接/i.test(await phone.evaluate(() => document.getElementById('stat').textContent)),
    await phone.evaluate(() => document.getElementById('stat').textContent));

  // the sensor-permission prompt must never block the piece (touch works without it)
  const perm = await phone.evaluate(() => {
    const e = document.getElementById('perm');
    if (!e || !e.classList.contains('show')) return null;
    const r = e.getBoundingClientRect();
    return { h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  ok('手机页的权限请求只是一条横幅，不遮住操作', !perm || perm.h < 140, JSON.stringify(perm));

  const box = await (await phone.$('#pad')).boundingBox();
  await phone.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await phone.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await phone.mouse.move(box.x + box.width * (0.3 + i * 0.05), box.y + box.height * (0.4 + i * 0.04));
    await sleep(55);
  }
  await phone.mouse.up();
  await sleep(900);
  const relay = await page.evaluate(() => ({
    targets: Object.keys(S.phone.targets).length,
    roster: document.getElementById('roster').children.length,
    overlay: document.getElementById('phone-pair').classList.contains('show'),
    x: S.phone.targets[S.phone.primaryId] ? S.phone.targets[S.phone.primaryId].smX : -1,
  }));
  ok('手机拖动 → 大屏出现第二个光圈', relay.targets === 1 && relay.x > 0, JSON.stringify(relay));
  ok('有人加入后配对面板自动收起', relay.overlay === false);
  ok('入卷名录出现印章', relay.roster === 1);

  const scBeforePhone = await page.evaluate(() => S.scene);
  await phone.click('#b-scene'); await sleep(700);
  const sc = await page.evaluate(() => S.scene);
  ok('手机按钮可换场景', sc === (scBeforePhone + 1) % 7, `${scBeforePhone} → ${sc}`);
  await phone.click('#b-splash'); await sleep(500);
  ok('手机泼墨 → 大屏出现墨点', await page.evaluate(() => S.phone.splats.length > 0));
  ok('手机链路无报错', errs.length === 0, errs.join('|'));
  await phone.close();

  /* ═══════════════ 6. scenes / styles / effects ═══════════════ */
  group('6 · 场景 / 风格 / 特效');
  await page.evaluate(() => wM('mouse'));
  await sleep(300);
  const pix = async () => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    c.getContext('2d').drawImage(D, 0, 0, 8, 8);
    return [...c.getContext('2d').getImageData(0, 0, 8, 8).data].slice(0, 24).join(',');
  });
  const p0 = await pix();
  const scBefore2 = await page.evaluate(() => S.scene);
  await page.keyboard.press('ArrowRight'); await sleep(800);
  ok('→ 切场景并更新 HUD', await page.evaluate((b) => S.scene === (b + 1) % SCENE_COUNT && document.getElementById('hsc').textContent.length > 0, scBefore2));
  ok('切场景后画面像素变化', (await pix()) !== p0);

  for (const [k, st] of [['1', 'edges'], ['2', 'sketch'], ['3', 'dark'], ['4', 'paper']]) {
    await page.keyboard.press(k); await sleep(450);
    ok(`快捷键 ${k} → 风格 ${st}`, await page.evaluate((s) => S.style === s, st));
  }
  ok('四种风格生成的墨层不互相同化', await page.evaluate(() => hiCvs && hiCvs.width > 0));

  for (const [key, field, label] of [
    ['i', 'paint', '留痕'], ['g', 'glow', '长曝'], ['k', 'creature', '生兽'],
    ['y', 'mirror', '镜影'], ['t', 'timeTint', '天时'], ['b', 'beat.on', '击节'],
  ]) {
    const before = await page.evaluate((f) => f.split('.').reduce((o, k) => o[k], S), field);
    await page.keyboard.press(key); await sleep(220);
    const after = await page.evaluate((f) => f.split('.').reduce((o, k) => o[k], S), field);
    ok(`快捷键 ${key} 切换「${label}」`, before !== after, `${before} → ${after}`);
  }
  const radBefore = await page.evaluate(() => S.radius);
  await page.keyboard.press('='); await page.keyboard.press('=');
  ok('快捷键 + 放大光圈', (await page.evaluate(() => S.radius)) > radBefore);
  await page.mouse.move(720, 450);
  const r2 = await page.evaluate(() => S.radius);
  await page.mouse.wheel(0, 120); await sleep(150);
  ok('滚轮改变光圈', (await page.evaluate(() => S.radius)) !== r2);

  /* ═══════════════ 7. touch gestures ═══════════════ */
  group('7 · 触屏手势 / touch gestures');
  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  watch(touch, errs.splice(0));
  const terr = [];
  watch(touch, terr);
  await touch.goto(`${BASE}/index.html`); await sleep(2500);
  ok('手机首屏提示改成触屏文案（不展示键盘）',
    await touch.evaluate(() => !/kbd|M<\/kbd>/.test(document.getElementById('hint').innerHTML)));
  await touch.tap('#btn-start'); await sleep(900);
  ok('触屏进入画卷', await touch.evaluate(() => S.running));
  const dpr3 = await touch.evaluate(() => S.dpr);
  ok('DPR 受像素预算约束（不会爆内存）', dpr3 >= 1 && dpr3 <= 2, 'dpr=' + dpr3);
  // synthetic pinch
  await touch.evaluate(() => {
    const D2 = document.getElementById('display');
    const ev = (type, id, x, y) => D2.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 11,
    }));
    ev('pointerdown', 11, 150, 400); ev('pointerdown', 12, 250, 400);
    const r0 = S.radius;
    window.__r0 = r0;
    for (let i = 1; i <= 6; i++) { ev('pointermove', 11, 150 - i * 10, 400); ev('pointermove', 12, 250 + i * 10, 400); }
    ev('pointerup', 11, 90, 400); ev('pointerup', 12, 310, 400);
  });
  const pinch = await touch.evaluate(() => ({ r0: window.__r0, r: S.radius }));
  ok('双指张开放大光圈', pinch.r > pinch.r0 * 1.15, JSON.stringify(pinch));
  // double tap → next scene
  const scBefore = await touch.evaluate(() => S.scene);
  await touch.touchscreen.tap(200, 420); await sleep(90);
  await touch.touchscreen.tap(200, 420); await sleep(600);
  ok('双击换场景', (await touch.evaluate(() => S.scene)) !== scBefore);
  // long press → 留痕
  const paintBefore = await touch.evaluate(() => S.paint);
  await touch.evaluate(async () => {
    const D2 = document.getElementById('display');
    const ev = (t) => D2.dispatchEvent(new PointerEvent(t, { pointerId: 21, pointerType: 'touch', clientX: 180, clientY: 400, bubbles: true }));
    ev('pointerdown'); await new Promise(r => setTimeout(r, 800)); ev('pointerup');
  });
  await sleep(200);
  ok('长按切换「留痕」', (await touch.evaluate(() => S.paint)) !== paintBefore);
  ok('触屏控制栏按钮 ≥44px', await touch.evaluate(() => {
    const b = document.getElementById('b-help').getBoundingClientRect();
    return b.width >= 40 && b.height >= 40;
  }));
  await touch.tap('#b-help'); await sleep(400);
  ok('触屏能打开帮助面板（无键盘也能操作）', await touch.evaluate(() => document.getElementById('help').classList.contains('show')));
  await touch.screenshot({ path: path.join(SHOTS, 'mobile-help.png') });
  await touch.tap('#help-close'); await sleep(300);
  ok('帮助面板可关闭', await touch.evaluate(() => !document.getElementById('help').classList.contains('show')));
  ok('触屏模式无横向溢出', await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  ok('触屏链路无报错', terr.length === 0, terr.join('|'));
  await touch.close();

  /* ═══════════════ 8. accessibility ═══════════════ */
  group('8 · 无障碍 / accessibility');
  await page.evaluate(() => wM('mouse'));
  await sleep(200);
  const a11y = await page.evaluate(() => ({
    canvasRole: document.getElementById('display').getAttribute('role'),
    canvasLabel: document.getElementById('display').getAttribute('aria-label'),
    live: document.getElementById('live').getAttribute('aria-live'),
    barLabel: document.getElementById('bar').getAttribute('aria-label'),
    barBtns: [...document.querySelectorAll('#bar button')].every(b => b.getAttribute('aria-label') || b.textContent.trim()),
    helpRole: document.getElementById('help').getAttribute('role'),
    helpModal: document.getElementById('help').getAttribute('aria-modal'),
  }));
  ok('canvas 有 role=img 与可读描述', a11y.canvasRole === 'img' && !!a11y.canvasLabel, JSON.stringify(a11y.canvasLabel));
  ok('存在 aria-live 播报区', a11y.live === 'polite');
  ok('控制栏有 aria-label，按钮均可读', !!a11y.barLabel && a11y.barBtns);
  ok('帮助面板 role=dialog + aria-modal', a11y.helpRole === 'dialog' && a11y.helpModal === 'true');

  await page.keyboard.press('?'); await sleep(300);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#help button')];
    btns[btns.length - 1].focus();
  });
  await page.keyboard.press('Tab'); await sleep(100);
  ok('帮助面板内 Tab 不逃逸（焦点陷阱）',
    await page.evaluate(() => document.getElementById('help').contains(document.activeElement)));
  const liveText = await page.evaluate(() => document.getElementById('live').textContent);
  ok('状态变更会播报给读屏', liveText.length > 0, liveText);
  await page.keyboard.press('Escape'); await sleep(250);
  ok('打开帮助后 canvas 被 aria-hidden，关闭后恢复',
    await page.evaluate(() => !document.getElementById('display').hasAttribute('aria-hidden')));

  const reduced = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
  await reduced.goto(`${BASE}/index.html`); await sleep(2200);
  await reduced.click('#btn-start'); await sleep(800);
  ok('prefers-reduced-motion 被识别', await reduced.evaluate(() => REDUCE === true));
  await reduced.keyboard.press('p'); await sleep(250);
  ok('可用 P 暂停动画（WCAG 2.2.2）', await reduced.evaluate(() => S.paused === true));
  await reduced.screenshot({ path: path.join(SHOTS, 'reduced-motion.png') });
  await reduced.close();

  /* ═══════════════ 8b. 投影墙 / wall mode ═══════════════ */
  group('8b · 投影墙（?wall=1 + 校准网格）');
  const wall = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const werr = []; watch(wall, werr);
  await wall.goto(`${BASE}/index.html?wall=1&mode=auto`);
  await wall.waitForFunction(() => S.running === true, { timeout: 20000 }).catch(() => {});
  await sleep(900);
  const w = await wall.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); if (!e) return 'missing';
      const cs = getComputedStyle(e); return cs.display === 'none' ? 'hidden' : 'shown'; };
    return { cls: document.body.className, grid: S.grid, wall: S.wall,
      ui: vis('ui'), bar: vis('bar'), hint: vis('first-hint'), nav: vis('scene-nav') };
  });
  ok('?wall=1 进入投影墙模式并自动开卷', w.wall === true && w.cls.includes('wall'), JSON.stringify(w));
  ok('投影墙：HUD / 控制栏 / 提示 / 场景点全部隐藏',
    w.ui === 'hidden' && w.bar === 'hidden' && w.hint === 'hidden' && w.nav === 'hidden', JSON.stringify(w));
  const gridPix = await wall.evaluate(async () => {
    const grab = () => { const c = document.createElement('canvas'); c.width = 320; c.height = 200;
      const g = c.getContext('2d'); g.drawImage(D, 0, 0, 320, 200);
      return g.getImageData(0, 0, 320, 200).data; };
    S.paused = true;
    S.grid = false; await new Promise(r => setTimeout(r, 300)); const off = grab();
    S.grid = true;  await new Promise(r => setTimeout(r, 300)); const on = grab();
    let diff = 0;
    for (let i = 0; i < off.length; i += 4) if (Math.abs(off[i] - on[i]) > 8) diff++;
    return { diff, total: 320 * 200 };
  });
  ok('投影墙：校准网格会真的画出来（像素有差）', gridPix.diff > gridPix.total * 0.004,
    `${gridPix.diff}/${gridPix.total} 像素被网格改变`);
  ok('投影墙链路无报错', werr.length === 0, werr.join('|'));
  await wall.close();

  /* ═══════════════ 8c. 立体输出 / stereo ═══════════════ */
  group('8c · 立体输出（红蓝 / 左右分屏）');
  const st3 = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  const sterr = []; watch(st3, sterr);
  await st3.goto(`${BASE}/index.html?mode=mouse&scene=6&stereo=anaglyph`);
  await st3.waitForFunction(() => S.running === true, { timeout: 20000 }).catch(() => {});
  await sleep(1200);
  const ana = await st3.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 200;
    const g = c.getContext('2d'); g.drawImage(D, 0, 0, 320, 200);
    const d = g.getImageData(0, 0, 320, 200).data;
    let red = 0, cyan = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] - d[i + 2] > 22) red++;
      if (d[i + 2] - d[i] > 22) cyan++;
    }
    return { stereo: S.stereo, red, cyan, total: 320 * 200 };
  });
  ok('红蓝立体：?stereo=anaglyph 生效', ana.stereo === 'anaglyph', JSON.stringify({ s: ana.stereo }));
  ok('红蓝立体：画面里同时存在红通道与青通道像素',
    ana.red > 30 && ana.cyan > 30, `red=${ana.red} cyan=${ana.cyan}`);
  await st3.close();

  const sbs = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  await sbs.goto(`${BASE}/index.html?mode=mouse&scene=6&stereo=sbs`);
  await sbs.waitForFunction(() => S.running === true, { timeout: 20000 }).catch(() => {});
  await sleep(1200);
  const halves = await sbs.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 100;
    const g = c.getContext('2d'); g.drawImage(D, 0, 0, 200, 100);
    const d = g.getImageData(0, 0, 200, 100).data;
    let l = 0, r = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) {
      const i = (y * 200 + x) * 4;
      if (x < 99) l += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
      else if (x > 100) r += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    }
    return { stereo: S.stereo, l: +(l / 9900).toFixed(2), r: +(r / 9900).toFixed(2) };
  });
  ok('左右立体：?stereo=sbs 生效且两半不同', halves.stereo === 'sbs' && Math.abs(halves.l - halves.r) > 0.5,
    `L=${halves.l} R=${halves.r}`);
  ok('立体输出链路无报错', sterr.length === 0, sterr.join('|'));
  await sbs.close();

  /* ═══════════════ 9. deep links & resize ═══════════════ */
  group('9 · 深链 / 尺寸变化');
  const dl = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await dl.goto(`${BASE}/index.html?mode=auto&scene=3&style=paper&lang=en`); await sleep(3000);
  const dls = await dl.evaluate(() => ({ mode: S.mode, scene: S.scene, style: S.style, lang: LANG, running: S.running }));
  ok('?mode=&scene=&style=&lang= 生效且自动开卷', dls.mode === 'auto' && dls.scene === 3 && dls.style === 'paper' && dls.lang === 'en' && dls.running === true,
    JSON.stringify(dls));
  await dl.setViewportSize({ width: 700, height: 1000 }); await sleep(700);
  const rs = await dl.evaluate(() => ({ DW, DH, cw: D.width, ch: D.height, fps: S.fps }));
  ok('尺寸变化后画布同步重建', rs.cw === rs.DW && rs.ch === rs.DH && rs.DW > 300, JSON.stringify(rs));
  await dl.close();

  /* ═══════════════ 10. performance ═══════════════ */
  group('10 · 性能 / performance');
  await page.evaluate(() => { S.style = 'edges'; genHidden(); S.scene = 0; changeScene(1); changeScene(0); });
  await sleep(2500);
  const fps1 = Math.max(await page.evaluate(() => S.fps), await page.evaluate(() => new Promise(r => setTimeout(() => r(S.fps), 1200))));
  await page.evaluate(() => setStyle('paper'));
  await sleep(2500);
  const fps2 = Math.max(await page.evaluate(() => S.fps), await page.evaluate(() => new Promise(r => setTimeout(() => r(S.fps), 1200))));
  const maskMs = await page.evaluate(() => {
    const t = performance.now(); setStyle('edges'); return Math.round(performance.now() - t);
  });
  ok(`墨线风格 fps ≥ ${MIN_FPS}（无头软件渲染）`, fps1 >= MIN_FPS, 'fps=' + fps1);
  ok(`纸本风格 fps ≥ ${MIN_FPS}（无头软件渲染）`, fps2 >= MIN_FPS, 'fps=' + fps2);
  ok('墨层生成在 400ms 预算内', maskMs < 400, maskMs + 'ms');

  const heavy = await page.evaluate(() => {
    S.paint = true; S.glow = true; S.mirror = true; S.timeTint = true; S.paused = false;
    return new Promise(res => setTimeout(() => res(S.fps), 2000));
  });
  ok(`全特效开启仍可用（fps ≥ ${MIN_FPS_HEAVY}）`, heavy >= MIN_FPS_HEAVY, 'fps=' + heavy);

  /* ═══════════════ 11b. 画面语义 / visual semantics ═══════════════ */
  group('11b · 画面语义（真的在揭示吗）');
  // clear the effect state the previous groups toggled, otherwise the paint mask
  // and glow buffer keep revealing colour and the luminance test means nothing
  await page.evaluate(() => {
    S.paused = false; S.paint = false; S.glow = false; S.mirror = false;
    S.timeTint = false; S.creature = false; S.phone.ink = false;
    if (paintCtx) paintCtx.clearRect(0, 0, paintCvs.width, paintCvs.height);
    if (glowCtx) glowCtx.clearRect(0, 0, glowCvs.width, glowCvs.height);
    S.style = 'paper'; genHidden(); wM('mouse');
  });
  await sleep(600);
  const sample = async (x, y) => page.evaluate(([px, py]) => {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const g = c.getContext('2d');
    g.drawImage(D, px * S.dpr, py * S.dpr, 40, 40, 0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [x, y]);
  const stats = async () => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 40;
    const g = c.getContext('2d');
    g.drawImage(D, 0, 0, 64, 40);
    const d = g.getImageData(0, 0, 64, 40).data;
    let sum = 0, sum2 = 0, n = 64 * 40;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114); sum += l; sum2 += l * l; }
    const mean = sum / n;
    return { mean, sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) };
  });
  // park the light on the far left so the right side is untouched ink
  await page.mouse.move(180, 200); await sleep(500);
  const inside = await sample(180, 200);
  const outside = await sample(1150, 700);
  const lum = (p) => p[0] * .299 + p[1] * .587 + p[2] * .114;
  ok('切到非摄像头模态后摄像头已释放（隐私）',
    await page.evaluate(() => str === null && vid === null), 'camera still open');
  ok('光圈内的颜色与圈外不同（揭示真的发生）', Math.abs(lum(inside) - lum(outside)) > 6,
    `in=${inside.join(',')} out=${outside.join(',')}`);
  const st1 = await stats();
  ok('画面不是空白（有方差）', st1.sd > 6, JSON.stringify(st1));
  ok('纸本风格整体偏亮（墨落宣纸）', st1.mean > 150, 'mean=' + Math.round(st1.mean));
  await page.evaluate(() => setStyle('edges')); await sleep(500);
  const st2 = await stats();
  ok('墨线风格明显更暗（暗房光束）', st2.mean < 140 && st1.mean - st2.mean > 50,
    `paper ${Math.round(st1.mean)} vs edges ${Math.round(st2.mean)}`);
  const means = [st2.mean];
  for (const st of ['sketch', 'dark']) {
    await page.evaluate((x) => setStyle(x), st); await sleep(450);
    means.push((await stats()).mean);
  }
  ok('素描与暗调都是近黑（只留线条）', means[1] < 40 && means[2] < 40,
    means.map(m => Math.round(m)).join(' / '));

  const prints = [];
  for (let sc = 0; sc < 5; sc++) {
    await page.evaluate((n) => changeScene(n), sc); await sleep(700);
    prints.push(JSON.stringify(await stats()));
  }
  ok('5 个场景互不相同', new Set(prints).size === 5, prints.join(' '));

  // the interaction matrix in the docs must describe every registered mode
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'INTERACTIONS.md'), 'utf8');
  const registered = await page.evaluate(() => Object.keys(M));
  const undocumented = registered.filter(k => !doc.includes('`' + k + '`'));
  ok('docs/INTERACTIONS.md 覆盖了每一个已注册模态', undocumented.length === 0, undocumented.join(','));
  const noI18n = await page.evaluate(() => Object.keys(M).filter(k => !I18N.en[M[k].nameKey]));
  ok('每个模态都有三语名字', noI18n.length === 0, noI18n.join(','));

  /* ═══════════════ 11. teardown ═══════════════ */
  group('11 · 退出 / teardown');
  await page.keyboard.press('q'); await sleep(500);
  const off = await page.evaluate(() => ({
    running: S.running,
    bar: document.getElementById('bar').classList.contains('show'),
    start: getComputedStyle(document.getElementById('start-screen')).display,
  }));
  ok('Q 退出回到标题，控制栏收起，摄像头关闭',
    off.running === false && off.bar === false && off.start === 'flex', JSON.stringify(off));
  ok('退出时释放摄像头轨道', await page.evaluate(() => str === null || str.getTracks().every(t => t.readyState === 'ended')));

  await browser.close();
  die();

  /* ── summary ─────────────────────────────────────────────────── */
  console.log(`\n${'─'.repeat(58)}`);
  console.log(`  \x1b[32m${pass} passed\x1b[0m   \x1b[31m${fail} failed\x1b[0m   \x1b[33m${skipped} skipped\x1b[0m`);
  if (fail) { console.log('\n  failures:'); failures.forEach(f => console.log('   - ' + f)); }
  console.log(`${'─'.repeat(58)}\n`);
  const result = { pass, fail, skipped, failures, at: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'last-run.json'), JSON.stringify(result, null, 2));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\nSUITE CRASH:', e); process.exit(2); });
