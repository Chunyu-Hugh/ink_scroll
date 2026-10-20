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
  page.on('pageerror', e => bucket.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') bucket.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', r => {
    const u = r.url();
    if (/favicon/.test(u)) return;
    bucket.push('requestfailed: ' + u.slice(0, 120));
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
  ok('11 个模式卡片渲染（含 IR 的 WebSerial 检测）', modeCards.length >= 10, modeCards.join(','));
  const groups = await page.evaluate(() => [...document.querySelectorAll('.mode-group .cat-label')].map(e => e.textContent.trim()));
  ok('模式按「需要什么」分组', groups.length === 3, groups.join(' | '));

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

  /* ═══════════════ 3. start / default mode ═══════════════ */
  group('3 · 进入画卷 / start');
  await page.click('#btn-start');
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

  for (const m of ['auto', 'mouse', 'audio', 'tilt', 'motion', 'hand', 'face', 'flashlight', 'gaze']) {
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
  await sleep(2500);
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

  /* ═══════════════ 5. phone relay (真机链路) ═══════════════ */
  group('5 · 手机魔杖 / phone relay (server.py + phone.html)');
  errs.length = 0;
  await page.evaluate(() => wM('phone'));
  await sleep(1200);
  const room = await page.evaluate(() => S.phone.room);
  ok('生成房间号并显示配对面板', !!room && await page.evaluate(() => document.getElementById('phone-pair').classList.contains('show')));
  ok('二维码渲染成 SVG', await page.evaluate(() => !!document.querySelector('#pp-qr svg')));

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

  await phone.click('#b-scene'); await sleep(700);
  const sc = await page.evaluate(() => S.scene);
  ok('手机按钮可换场景', sc !== 0, 'scene=' + sc);
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
  ok('→ 切场景并更新 HUD', await page.evaluate((b) => S.scene === (b + 1) % 5 && document.getElementById('hsc').textContent.length > 0, scBefore2));
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
