const { chromium } = require('playwright');
const path = require('path');
const V = path.resolve(process.argv[2]), MODE = process.argv[3];
(async () => {
  const b = await chromium.launch({ executablePath:'/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
    args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
      '--use-file-for-fake-video-capture='+V] });
  const p = await b.newPage({ viewport:{width:900,height:600} });
  const logs=[]; p.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,120)));
  p.on('pageerror',e=>logs.push('ERR '+e.message.slice(0,120)));
  await p.goto(`http://127.0.0.1:8914/index.html?mode=${MODE}`); await p.waitForTimeout(4000);
  console.log('boot:', await p.evaluate(()=>({run:S.running, mode:S.mode, err:document.getElementById('error-screen').classList.contains('show'), loading:document.getElementById('loading').style.display})));
  await p.evaluate(()=>start()); await p.waitForTimeout(4000);
  console.log('after start:', await p.evaluate(()=>({run:S.running, vid: vid?[vid.videoWidth,vid.videoHeight,vid.readyState]:null, err:document.getElementById('error-screen').classList.contains('show')})));
  for (let i=0;i<10;i++) await p.waitForTimeout(700);
  console.log(MODE, JSON.stringify(await p.evaluate(()=>({
    hlm:S.hlm?S.hlm.length:null, gesture:S.gesture, hpos:S.hpos,
    faceSeen:S.face.seen, nx:S.face.nx, ear:S.eyes.ear,
    spot:(()=>{try{const s=M[S.mode].spot();return s?{x:Math.round(s.x),y:Math.round(s.y)}:null}catch(e){return 'err:'+e.message}})()
  }))));
  console.log(logs.filter(l=>/ERR|error|Warn/i.test(l)).slice(0,5).join('\n'));
  await b.close();
})();
