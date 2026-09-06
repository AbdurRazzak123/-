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
const FALLBACK_NATIVE_CODE='<script async="async" data-cfasync="false" src="https://closurenosy.com/0327a0284d2be31da068607e5bceb134/invoke.js"></script><div id="container-0327a0284d2be31da068607e5bceb134"></div>';
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
  // The Native Banner must be inserted into the LIVE document before its
  // external <script> is appended; scripts added to a detached DOM tree may
  // never execute when that tree is later attached.
  const DESIGN_WIDTH=1200;
  const DEFAULT_HEIGHT=300;
  const wrap=document.createElement('div');
  wrap.className='sheet-ad-code-wrap';
  wrap.style.cssText='position:relative;width:100%;max-width:100%;height:'+DEFAULT_HEIGHT+'px;margin:0 auto;padding:0;overflow:hidden;display:block;line-height:0;box-sizing:border-box;';
  const canvas=document.createElement('div');
  canvas.className='sheet-ad-desktop-canvas';
  canvas.style.cssText='position:absolute;left:0;top:0;width:'+DESIGN_WIDTH+'px;min-width:'+DESIGN_WIDTH+'px;max-width:none;margin:0;padding:0;border:0;overflow:hidden;transform-origin:top left;line-height:normal;box-sizing:border-box;background:transparent;';
  wrap.appendChild(canvas);
  const tpl=document.createElement('template');
  tpl.innerHTML=String(code||'');
  const nodes=Array.from(tpl.content.childNodes);
  // Non-script markup is prepared now. Scripts are recreated only after the
  // wrapper is attached to the real page, preserving original order.
  nodes.forEach(node=>{
    if(!(node.nodeType===1 && node.tagName.toLowerCase()==='script')){
      canvas.appendChild(node.cloneNode(true));
    }
  });
  const scripts=nodes.filter(n=>n.nodeType===1 && n.tagName.toLowerCase()==='script');
  wrap._adScripts=scripts;
  wrap._adCanvas=canvas;
  wrap._adDesignWidth=DESIGN_WIDTH;
  wrap._adDefaultHeight=DEFAULT_HEIGHT;
  return wrap;
}
function activateAdFrame(wrap){
  const canvas=wrap&&wrap._adCanvas;
  const nodes=wrap&&wrap._adScripts||[];
  if(!canvas||wrap._adActivated)return;
  wrap._adActivated=true;
  // Execute scripts in exactly the same order as supplied by the advertiser.
  nodes.forEach(node=>{
    const sc=document.createElement('script');
    for(const attr of Array.from(node.attributes))sc.setAttribute(attr.name,attr.value);
    if(node.src || node.getAttribute('src')) sc.src=node.getAttribute('src');
    else sc.textContent=node.textContent||'';
    canvas.appendChild(sc);
  });
  const DESIGN_WIDTH=wrap._adDesignWidth||1200;
  const DEFAULT_HEIGHT=wrap._adDefaultHeight||300;
  const getHeight=()=>{
    let h=DEFAULT_HEIGHT;
    try{
      const r=canvas.getBoundingClientRect();
      if(r.height>0)h=Math.max(h,r.height);
      const all=canvas.querySelectorAll('*');
      for(let i=0;i<all.length;i++){
        const el=all[i];
        try{
          const b=el.getBoundingClientRect();
          if(b.width>0&&b.height>0)h=Math.max(h,b.bottom-canvas.getBoundingClientRect().top);
        }catch(e){}
      }
    }catch(e){}
    return Math.min(900,Math.max(90,Math.ceil(h||DEFAULT_HEIGHT)));
  };
  const fit=()=>{
    const available=Math.max(1,wrap.clientWidth||DESIGN_WIDTH);
    const scale=Math.min(1,available/DESIGN_WIDTH);
    canvas.style.transform='scale('+scale+')';
    const rawHeight=getHeight();
    canvas.style.height=rawHeight+'px';
    wrap.style.height=Math.max(90,Math.ceil(rawHeight*scale))+'px';
  };
  fit();
  [50,150,300,600,1000,1800,3000,5000,8000].forEach(t=>setTimeout(fit,t));
  window.addEventListener('resize',fit,{passive:true});
  try{
    if(window.ResizeObserver){
      const ro=new ResizeObserver(fit);
      ro.observe(canvas);
      wrap._adResizeObserver=ro;
    }
  }catch(e){}
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
    const frame=makeAdFrame(ad.code,ad.title); slot.appendChild(frame); activateAdFrame(frame);
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
  const slots=getSlots();
  const positions=mapSlots(slots);
  if(!positions.length||positions.length!==slots.length){console.warn('Ads loader: unsupported slot layout',slots.length);return;}
  try{
    const rows=await fetchRows();
    const ads={TOP:[],MIDDLE:[],MIDDLE_TOP:[],MIDDLE_BOTTOM:[],BOTTOM:[],ALL:[]};
    rows.forEach(r=>{
      const pos=normalizePosition(val(r,0));
      if(!pos||!Object.prototype.hasOwnProperty.call(ads,pos)||!active(val(r,1)))return;
      const ad={code:val(r,5),image:val(r,2),click:val(r,3),title:val(r,4)};
      if(ad.code||ad.image)ads[pos].push(ad);
    });
    const used={TOP:0,MIDDLE:0,MIDDLE_TOP:0,MIDDLE_BOTTOM:0,BOTTOM:0,ALL:0};
    const usedCodes=new Set();
    slots.forEach((slot,i)=>{
      let pos=positions[i];
      if(pos==='MIDDLE'&&slots.length===4){
        const middleIndex=positions.slice(0,i+1).filter(x=>x==='MIDDLE').length;
        pos=middleIndex===1?'MIDDLE_TOP':'MIDDLE_BOTTOM';
      }
      const attr=pos.toLowerCase().replace(/_/g,'-');
      slot.setAttribute('data-ad-position',attr);
      slot.setAttribute('data-ad-slot',attr);
      const ad=pick(ads,pos,used);
      if(ad && ad.code && usedCodes.has(ad.code)){
        // Native/code snippets often contain a fixed container id. Running the exact
        // same snippet twice in one document is unsafe, so execute it only once.
        slot.setAttribute('data-ad-loaded','duplicate-code-skipped');
        return;
      }
      if(ad && render(slot,ad)){
        if(ad.code)usedCodes.add(ad.code);
      }else{
        slot.setAttribute('data-ad-loaded','no-ad');
      }
    });
  }catch(e){
    console.warn('Google Sheet Ads load failed:',e);
    // Last-resort safety net for the user's current Native Banner. This is only
    // used when the Google Sheet itself cannot be fetched; the Sheet remains the
    // primary source of ad code.
    const top=slots.find(s=>canonicalSlotPosition(s)==='TOP')||slots[0];
    if(top && !top.hasAttribute('data-ad-loaded')){
      try{
        render(top,{code:FALLBACK_NATIVE_CODE,title:'Advertisement'});
        top.setAttribute('data-ad-fallback','native');
      }catch(err){console.warn('Native fallback failed:',err);}
    }
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
