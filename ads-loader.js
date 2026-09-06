/* বাংলা সংবাদ — Google Sheet controlled Ads
   Ads tab columns:
   A Position | B Active | C Image URL | D Click URL | E Title | F Ad Code

   Supported page layouts:
   2 slots = TOP, BOTTOM
   3 slots = TOP, MIDDLE, BOTTOM
   4 slots = TOP, MIDDLE TOP, MIDDLE BOTTOM, BOTTOM

   Supported Position values in Google Sheet:
   TOP, MIDDLE, MIDDLE TOP, MIDDLE BOTTOM, BOTTOM, ALL

   IMPORTANT:
   - The same ad/video/code can be used in all four positions by putting the
     same ad in each of the four rows, OR by using one row with Position=ALL.
   - Different companies can use four separate rows: TOP, MIDDLE TOP,
     MIDDLE BOTTOM, BOTTOM.
   - Exact position rows always have priority over ALL/fallback rows.
*/
(function(){
'use strict';
const SHEET_ID='1gX73WskIs3D-8IcyPJ24NT0xn1KIEJSjMXOF9nCQqTg';
const URL='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=out:json&sheet=Ads';
const val=(r,i)=>r&&r.c&&r.c[i]&&r.c[i].v!=null?String(r.c[i].v).trim():'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function parse(raw){const a=raw.indexOf('{'),b=raw.lastIndexOf('}')+1;if(a<0||b<=a)throw Error('Invalid Ads response');const d=JSON.parse(raw.slice(a,b));return d.table&&Array.isArray(d.table.rows)?d.table.rows:[];}
function active(v){v=String(v||'').toLowerCase().trim();return !v||['yes','true','1','active','on','হ্যাঁ','চালু'].includes(v);}
function normalizePosition(v){
  const p=String(v||'').toUpperCase().trim().replace(/[-_]+/g,' ').replace(/\s+/g,' ');
  if(p==='TOP') return 'TOP';
  if(p==='BOTTOM'||p==='FOOTER') return 'BOTTOM';
  if(p==='MIDDLE TOP'||p==='MIDDLETOP') return 'MIDDLE_TOP';
  if(p==='MIDDLE BOTTOM'||p==='MIDDLEBOTTOM') return 'MIDDLE_BOTTOM';
  if(p==='MIDDLE') return 'MIDDLE';
  if(p==='ALL'||p==='EVERYWHERE'||p==='ALL POSITIONS') return 'ALL';
  return '';
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function safeUrl(s){const u=String(s||'').trim();return /^(https?:|mailto:|tel:)/i.test(u)?u:'';}
function imageAd(img,click,title){
  const src=safeUrl(img),href=safeUrl(click),alt=esc(title||'Advertisement');
  if(!src)return '';
  const image='<img src="'+esc(src)+'" alt="'+alt+'" loading="lazy" style="display:block;width:100%;height:auto;max-width:100%;object-fit:contain;border:0;margin:0;padding:0">';
  return href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:auto;text-decoration:none">'+image+'</a>':image;
}
function makeAdFrame(code,title){
  // AD-ONLY DESKTOP MODE: the page itself stays fully mobile-responsive.
  // Force the Adsterra native creative to render on a fixed desktop canvas.
  // On phones only the finished canvas is scaled down; the ad cards must not
  // switch to the provider's mobile/vertical layout.
  const DESIGN_WIDTH=1200;
  const DEFAULT_HEIGHT=300;

  const wrap=document.createElement('div');
  wrap.className='sheet-ad-code-wrap';
  wrap.style.cssText='position:relative;width:100%;max-width:100%;height:'+DEFAULT_HEIGHT+'px;margin:0 auto;padding:0;overflow:hidden;display:block;line-height:0;box-sizing:border-box;';

  const iframe=document.createElement('iframe');
  iframe.title=String(title||'Advertisement');
  iframe.setAttribute('aria-label',String(title||'Advertisement'));
  iframe.setAttribute('scrolling','no');
  iframe.setAttribute('frameborder','0');
  iframe.setAttribute('sandbox','allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
  iframe.style.cssText='display:block;position:absolute;left:0;top:0;width:'+DESIGN_WIDTH+'px;height:'+DEFAULT_HEIGHT+'px;min-width:'+DESIGN_WIDTH+'px;max-width:none;border:0;margin:0;padding:0;background:transparent;overflow:hidden;transform-origin:top left;';

  // The provider may inspect the viewport from inside its script.  Give it a
  // desktop viewport before its code runs.  Sandbox also prevents it from
  // reading the phone's top-level viewport and choosing a mobile layout.
  const bootstrap=`<script>(function(){
try{Object.defineProperty(window,'innerWidth',{configurable:true,get:function(){return ${DESIGN_WIDTH};}})}catch(e){}
try{Object.defineProperty(navigator,'userAgent',{configurable:true,get:function(){return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';}})}catch(e){}
try{Object.defineProperty(navigator,'platform',{configurable:true,get:function(){return 'Win32';}})}catch(e){}
try{Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,get:function(){return 0;}})}catch(e){}
try{Object.defineProperty(window,'outerWidth',{configurable:true,get:function(){return ${DESIGN_WIDTH};}})}catch(e){}
try{Object.defineProperty(window,'innerHeight',{configurable:true,get:function(){return 800;}})}catch(e){}
try{Object.defineProperty(window,'outerHeight',{configurable:true,get:function(){return 800;}})}catch(e){}
try{Object.defineProperty(screen,'width',{configurable:true,get:function(){return ${DESIGN_WIDTH};}})}catch(e){}
try{Object.defineProperty(screen,'availWidth',{configurable:true,get:function(){return ${DESIGN_WIDTH};}})}catch(e){}
try{if(window.visualViewport)Object.defineProperty(window.visualViewport,'width',{configurable:true,get:function(){return ${DESIGN_WIDTH};}})}catch(e){}
try{Object.defineProperty(document.documentElement,'clientWidth',{configurable:true,get:function(){return ${DESIGN_WIDTH};}})}catch(e){}
try{Object.defineProperty(document.body,'clientWidth',{configurable:true,get:function(){return ${DESIGN_WIDTH};}})}catch(e){}
try{window.matchMedia=function(q){var m=String(q||'').match(/(min|max)-width\\s*:\\s*(\\d+)px/i),w=${DESIGN_WIDTH},ok=true;if(m){var n=Number(m[2]);ok=m[1].toLowerCase()==='min'?w>=n:w<=n;}return {matches:ok,media:String(q||''),onchange:null,addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return false;}}}}catch(e){}
})();<\/script>`;

  const css=`<style>
html,body{width:${DESIGN_WIDTH}px!important;min-width:${DESIGN_WIDTH}px!important;max-width:${DESIGN_WIDTH}px!important;margin:0!important;padding:0!important;overflow:hidden!important;}
body{line-height:normal!important;}
*,*:before,*:after{box-sizing:border-box;}
img,iframe,video,svg,canvas{max-width:none!important;}
[id^=container-]{width:${DESIGN_WIDTH}px!important;min-width:${DESIGN_WIDTH}px!important;max-width:${DESIGN_WIDTH}px!important;}
[class*='container']{max-width:${DESIGN_WIDTH}px!important;}
</style>`;
  const doc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width='+DESIGN_WIDTH+', initial-scale=1, maximum-scale=1, user-scalable=no">'+css+bootstrap+'</head><body style="width:'+DESIGN_WIDTH+'px!important;min-width:'+DESIGN_WIDTH+'px!important;max-width:'+DESIGN_WIDTH+'px!important;margin:0!important;padding:0!important;overflow:hidden!important;">'+String(code||'')+'</body></html>';
  iframe.srcdoc=doc;
  wrap.appendChild(iframe);

  let rawHeight=DEFAULT_HEIGHT;
  const getHeight=()=>{
    try{
      const d=iframe.contentDocument;
      if(!d||!d.body)return rawHeight;
      let h=Math.max(d.body.scrollHeight||0,d.documentElement.scrollHeight||0,d.body.getBoundingClientRect().height||0);
      const all=d.body.querySelectorAll('*');
      for(let i=0;i<all.length;i++){try{const r=all[i].getBoundingClientRect();if(r.width>0&&r.height>0)h=Math.max(h,r.bottom)}catch(e){}}
      return Math.min(900,Math.max(90,Math.ceil(h||DEFAULT_HEIGHT)));
    }catch(e){return rawHeight;}
  };
  const fit=()=>{
    const available=Math.max(1,wrap.parentElement?wrap.parentElement.clientWidth:wrap.clientWidth||DESIGN_WIDTH);
    const scale=Math.min(1,available/DESIGN_WIDTH);
    iframe.style.transform='scale('+scale+')';
    rawHeight=getHeight();
    iframe.style.height=rawHeight+'px';
    wrap.style.height=Math.ceil(rawHeight*scale)+'px';
  };
  iframe.addEventListener('load',()=>{
    fit();
    [100,300,700,1200,2500,5000].forEach(t=>setTimeout(fit,t));
    try{if(window.ResizeObserver&&iframe.contentDocument&&iframe.contentDocument.body){const ro=new ResizeObserver(fit);ro.observe(iframe.contentDocument.body);}}catch(e){}
  });
  window.addEventListener('resize',fit,{passive:true});
  setTimeout(fit,0);
  return wrap;
}
function imageAdNode(slot,img,click,title){
  const src=safeUrl(img),href=safeUrl(click),alt=esc(title||'Advertisement');
  if(!src)return false;
  const image=document.createElement('img');
  image.src=src; image.alt=title||'Advertisement'; image.loading='lazy';
  image.style.cssText='display:block;width:100%;height:auto;max-width:100%;object-fit:contain;border:0;margin:0;padding:0;';
  if(href){
    const a=document.createElement('a'); a.href=href; a.target='_blank'; a.rel='noopener noreferrer';
    a.style.cssText='display:block;width:100%;height:auto;text-decoration:none;'; a.appendChild(image); slot.appendChild(a);
  }else slot.appendChild(image);
  return true;
}
function render(slot,ad){
  if(!ad)return false;
  slot.innerHTML='';
  if(ad.code){
    slot.appendChild(makeAdFrame(ad.code,ad.title));
  }else if(!imageAdNode(slot,ad.image,ad.click,ad.title)){
    return false;
  }
  slot.classList.add('ad-loaded');
  slot.setAttribute('data-ad-loaded','yes');
  return true;
}
function canonicalSlotPosition(slot){
  return normalizePosition(slot.getAttribute('data-ad-position')||slot.getAttribute('data-ad-slot')||'');
}
function getSlots(){
  const seen=new Set();
  return Array.from(document.querySelectorAll('.sheet-ad-slot[data-ad-slot],.sheet-ad-slot[data-ad-position],.ad-slot[data-ad-slot],.ad-slot[data-ad-position]')).filter(s=>{
    if(seen.has(s))return false;seen.add(s);return true;
  });
}
function mapSlots(slots){
  const explicit=slots.map(canonicalSlotPosition);
  // Explicit position attributes are authoritative. This is used by Details,
  // whose four slots are TOP/MIDDLE TOP/MIDDLE BOTTOM/BOTTOM.
  if(explicit.every(Boolean))return explicit;
  const count=slots.length;
  if(count===2)return ['TOP','BOTTOM'];
  if(count===3)return ['TOP','MIDDLE','BOTTOM'];
  if(count===4)return ['TOP','MIDDLE_TOP','MIDDLE_BOTTOM','BOTTOM'];
  return [];
}
function pick(adSets,pos,used){
  // Exact position first.
  let list=adSets[pos]||[];
  if(list.length){
    // A position can contain multiple active rows. Cycle through them per page.
    const i=used[pos]||0; used[pos]=i+1;
    return list[i%list.length];
  }
  // ALL is intentionally reusable: one row can power every slot.
  list=adSets.ALL||[];
  if(list.length)return list[0];
  // Legacy MIDDLE row supports the single MIDDLE slot on index.html.
  if(pos==='MIDDLE'){
    list=adSets.MIDDLE||[];
    if(list.length)return list[0];
  }
  // Legacy MIDDLE rows can also fill a missing middle-specific row.
  if(pos==='MIDDLE_TOP'||pos==='MIDDLE_BOTTOM'){
    list=adSets.MIDDLE||[];
    if(list.length){const i=used.MIDDLE||0;used.MIDDLE=i+1;return list[i%list.length];}
  }
  return null;
}
async function fetchRows(){
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const r=await fetch(URL+'&_='+Date.now()+'-'+attempt,{cache:'no-store',credentials:'omit'});
      if(!r.ok)throw Error('Ads sheet HTTP '+r.status);
      return parse(await r.text());
    }catch(e){last=e;if(attempt<2)await sleep(700*(attempt+1));}
  }
  throw last||Error('Ads sheet fetch failed');
}
async function load(){
  try{
    const rows=await fetchRows();
    const ads={TOP:[],MIDDLE:[],MIDDLE_TOP:[],MIDDLE_BOTTOM:[],BOTTOM:[],ALL:[]};
    rows.forEach(r=>{
      const pos=normalizePosition(val(r,0));
      if(!pos||!Object.prototype.hasOwnProperty.call(ads,pos)||!active(val(r,1)))return;
      const ad={code:val(r,5),image:val(r,2),click:val(r,3),title:val(r,4)};
      if(ad.code||ad.image)ads[pos].push(ad);
    });

    const slots=getSlots();
    const positions=mapSlots(slots);
    if(!positions.length||positions.length!==slots.length){console.warn('Ads loader: unsupported slot layout',slots.length);return;}

    const used={TOP:0,MIDDLE:0,MIDDLE_TOP:0,MIDDLE_BOTTOM:0,BOTTOM:0,ALL:0};
    slots.forEach((slot,i)=>{
      let pos=positions[i];
      // Legacy generic MIDDLE slots on a 4-slot page become two independent positions.
      if(pos==='MIDDLE'&&slots.length===4){
        const middleIndex=positions.slice(0,i+1).filter(x=>x==='MIDDLE').length;
        pos=middleIndex===1?'MIDDLE_TOP':'MIDDLE_BOTTOM';
      }
      const attr=pos.toLowerCase().replace(/_/g,'-');
      slot.setAttribute('data-ad-position',attr);
      slot.setAttribute('data-ad-slot',attr);
      const ad=pick(ads,pos,used);
      if(ad)render(slot,ad);
      else slot.setAttribute('data-ad-loaded','no-ad');
    });
  }catch(e){console.warn('Google Sheet Ads load failed:',e);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
