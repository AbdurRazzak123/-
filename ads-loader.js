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
  const iframe=document.createElement('iframe');
  iframe.title=String(title||'Advertisement');
  iframe.setAttribute('aria-label',String(title||'Advertisement'));
  iframe.style.cssText='display:block;width:100%;max-width:100%;border:0;margin:0 auto;padding:0;min-height:90px;height:250px;background:transparent;overflow:hidden;';
  // Run each ad code inside its own document. This is important because many ad
  // networks use a fixed container id. Separate iframes let the SAME code be
  // used in multiple slots without duplicate-id conflicts.
  const doc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;width:100%;overflow:hidden;">'+String(code||'')+'</body></html>';
  iframe.srcdoc=doc;
  iframe.addEventListener('load',()=>{
    try{
      const d=iframe.contentDocument;
      if(!d)return;
      const resize=()=>{
        const h=Math.max(90,Math.min(1200,Math.ceil(Math.max(d.documentElement.scrollHeight||0,d.body&&d.body.scrollHeight||0))));
        if(h>90)iframe.style.height=h+'px';
      };
      resize();
      setTimeout(resize,700);
      setTimeout(resize,1800);
      setTimeout(resize,3500);
    }catch(e){/* cross-document resize is best-effort */}
  },{once:true});
  return iframe;
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
