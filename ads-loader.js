/* বাংলা সংবাদ — Google Sheet controlled Ads
   Ads sheet columns:
   A Position | B Active | C Image URL | D Click URL | E Title | F Ad Code

   Slot mapping by page:
   - 2 ad slots: TOP, BOTTOM
   - 3 ad slots: TOP, MIDDLE, BOTTOM
   - 4 ad slots: TOP, MIDDLE, MIDDLE, BOTTOM

   Multiple rows with the same Position are supported. This allows:
   - the same ad to be reused in several positions by repeating its row/data;
   - different companies/ads to run in different positions;
   - two different MIDDLE ads on pages that have two middle slots.
*/
(function(){
'use strict';
const SHEET_ID='1gX73WskIs3D-8IcyPJ24NT0xn1KIEJSjMXOF9nCQqTg';
const URL='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=out:json&sheet=Ads';
const requestUrl=()=>URL+'&_='+Date.now();
const val=(r,i)=>r&&r.c&&r.c[i]&&r.c[i].v!=null?String(r.c[i].v).trim():'';
function parse(raw){const a=raw.indexOf('{'),b=raw.lastIndexOf('}')+1;if(a<0||b<=a)throw Error('Invalid Ads response');const d=JSON.parse(raw.slice(a,b));return d.table?.rows||[];}
function active(v){v=v.toLowerCase().trim();return !v||['yes','true','1','active','on','হ্যাঁ','চালু'].includes(v);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function safeUrl(s){const u=String(s||'').trim();return /^(https?:|mailto:|tel:)/i.test(u)?u:'#';}
function imageAd(img,click,title){
  const src=safeUrl(img), href=safeUrl(click), alt=esc(title||'Advertisement');
  if(src==='#') return '';
  const image='<img src="'+esc(src)+'" alt="'+alt+'" loading="lazy" style="display:block;width:100%;height:auto;max-width:100%;object-fit:contain;border:0;margin:0;padding:0">';
  return '<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;height:auto;text-decoration:none">'+image+'</a>';
}
function runScripts(slot){
  slot.querySelectorAll('script').forEach(old=>{const s=document.createElement('script');for(const a of old.attributes)s.setAttribute(a.name,a.value);s.text=old.text||old.textContent||'';old.replaceWith(s);});
}
function render(slot,ad){
  if(!ad) return;
  const content=ad.code || imageAd(ad.image,ad.click,ad.title);
  if(!content) return;
  slot.innerHTML=content;
  runScripts(slot);
  slot.classList.add('ad-loaded');
}
function load(){
 fetch(requestUrl(),{cache:'no-store'}).then(r=>r.text()).then(parse).then(rows=>{
   const ads={TOP:[],MIDDLE:[],BOTTOM:[]};
   rows.forEach(r=>{
     const pos=val(r,0).toUpperCase();
     if(!Object.prototype.hasOwnProperty.call(ads,pos)||!active(val(r,1))) return;
     const ad={code:val(r,5),image:val(r,2),click:val(r,3),title:val(r,4)};
     if(ad.code||ad.image) ads[pos].push(ad);
   });

   // Map slots by their actual page layout/order:
   // 2 slots = TOP, BOTTOM
   // 3 slots = TOP, MIDDLE, BOTTOM
   // 4 slots = TOP, MIDDLE, MIDDLE, BOTTOM
   // The DOM order is the source of truth, so a page can freely have 2/3/4 slots.
   const slots=Array.from(document.querySelectorAll('[data-ad-slot]')).filter(slot=>{
     const p=(slot.getAttribute('data-ad-slot')||'').toUpperCase();
     return ['TOP','MIDDLE','BOTTOM'].includes(p);
   });
   const count=slots.length;
   const layout=count===2?['TOP','BOTTOM']:
               count===3?['TOP','MIDDLE','BOTTOM']:
               count===4?['TOP','MIDDLE','MIDDLE','BOTTOM']:null;

   if(!layout){
     console.warn('Ads loader: unsupported slot count',count,'— expected 2, 3, or 4.');
     return;
   }

   const used={TOP:0,MIDDLE:0,BOTTOM:0};
   slots.forEach((slot,i)=>{
     const pos=layout[i];
     // Keep the HTML data-ad-slot value consistent with the layout.
     slot.setAttribute('data-ad-slot',pos.toLowerCase());
     const list=ads[pos];
     if(!list.length) return;
     const ad=list[used[pos]] || list[0];
     used[pos]++;
     // If there are fewer Sheet rows than slots, reuse the first active ad.
     render(slot,ad);
   });
 }).catch(e=>console.warn('Google Sheet Ads load failed:',e));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
