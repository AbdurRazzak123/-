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
function runScripts(slot){
  slot.querySelectorAll('script').forEach(old=>{
    const s=document.createElement('script');
    for(const a of old.attributes)s.setAttribute(a.name,a.value);
    if(old.src){s.src=old.src;s.async=old.async;s.defer=old.defer;}
    else s.text=old.text||old.textContent||'';
    old.replaceWith(s);
  });
}
function render(slot,ad){
  if(!ad)return false;
  const content=ad.code||imageAd(ad.image,ad.click,ad.title);
  if(!content)return false;
  slot.innerHTML=content;
  runScripts(slot);
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
  const count=slots.length;
  const explicit=slots.some(s=>/^(MIDDLE_TOP|MIDDLE_BOTTOM)$/i.test(canonicalSlotPosition(s)));
  if(explicit)return slots.map(s=>canonicalSlotPosition(s));
  if(count===2)return ['TOP','BOTTOM'];
  if(count===3)return ['TOP','MIDDLE','BOTTOM'];
  if(count===4)return ['TOP','MIDDLE','MIDDLE','BOTTOM'];
  return [];
}
function pick(adSets,pos,used){
  // 1) Exact position is always preferred.
  let key=pos;
  let list=adSets[key]||[];
  if(list.length){
    const i=used[key]||0;
    used[key]=i+1;
    return list[i]||list[0];
  }
  // 2) One explicit ALL row can be reused independently in every slot.
  list=adSets.ALL||[];
  if(list.length){
    const i=used.ALL||0;
    used.ALL=i+1;
    return list[i]||list[0];
  }
  // 3) Legacy MIDDLE row is a fallback for either middle position.
  if(pos==='MIDDLE_TOP'||pos==='MIDDLE_BOTTOM'){
    list=adSets.MIDDLE||[];
    if(list.length){
      const i=used.MIDDLE||0;
      used.MIDDLE=i+1;
      return list[i]||list[0];
    }
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
