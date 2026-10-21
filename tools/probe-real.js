const { chromium } = require('playwright');
const V = process.argv[2], MODE = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath:'/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
    args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
      '--use-file-for-fake-video-capture='+require('path').resolve(V)] });
  const p = await b.newPage({ viewport:{width:900,height:600} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,100)));
  await p.goto(`http://127.0.0.1:8914/index.html?mode=${MODE}`); await p.waitForTimeout(3000);
  for (let i=0;i<14;i++) { await p.waitForTimeout(700); }
  const st = await p.evaluate(()=>({
    mode:S.mode,
    hlm: S.hlm? S.hlm.length : null,
    gesture: S.gesture,
    hpos: S.hpos? [Math.round(S.hpos.x), Math.round(S.hpos.y)] : null,
    faceSeen: S.face.seen, faceNx: S.face.nx?+S.face.nx.toFixed(2):null, faceNy: S.face.ny?+S.face.ny.toFixed(2):null,
    open: S.face.open!=null?+S.face.open.toFixed(2):null,
    ear: S.eyes.ear!=null?+S.eyes.ear.toFixed(2):null,
    spot: (()=>{ try{ const s=M[S.mode].spot(); return s?{x:Math.round(s.x),y:Math.round(s.y),r:Math.round(s.radius)}:null; }catch(e){ return 'err' } })(),
    video: vid? [vid.videoWidth,vid.videoHeight,vid.readyState] : null,
  }));
  console.log(MODE, JSON.stringify(st));
  if (errs.length) console.log('  errs:', errs.slice(0,3));
  await p.screenshot({path:`/tmp/real-${MODE}.png`});
  await b.close();
})();
