/* Load only the requested asset from the immutable, previously published atlas.
 * GitHub Pages supports byte ranges. A server without ranges downloads the bundle
 * once as a fallback. Per-asset hashes protect offsets and cached responses.
 */
(()=>{'use strict';
const root=new URL('.',location.href), decoded=new Map();
let manifestPromise, overviewPromise, probePromise, fullBundle=null, fullBundlePromise=null;
const manifest=()=>manifestPromise||(manifestPromise=fetchChecked('assets/atlas-manifest.json').then(r=>r.json()).catch(e=>{manifestPromise=null;throw e;}));
function normalize(path){return String(path).replace(/^.*?\/\/[^/]+\//,'').replace(/^\.\//,'').split('?')[0].replace(/^\//,'');}
async function fetchChecked(path,options={}){
  let error;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
    try{const response=await fetch(new URL(path,root),{...options,signal:controller.signal,cache:attempt?'reload':'default'});
      if(!response.ok)throw Error(`Download failed (${response.status}): ${path}`);
      // Consume the body before clearing the timeout so stalled downloads recover.
      const body=await response.arrayBuffer();return new Response(body,{status:response.status,headers:response.headers});
    }catch(e){error=e;}finally{clearTimeout(timeout);}
  }
  throw error;
}
async function whole(m){
  if(!fullBundlePromise)fullBundlePromise=(async()=>{
    const response=await fetchChecked(m.bundle),body=await response.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),b=>b.toString(16).padStart(2,'0')).join('');
    if(body.byteLength!==m.bytes||hash!==m.sha256)throw Error('The atlas download is incomplete. Please try again.');
    fullBundle=body;return body;
  })().catch(e=>{fullBundlePromise=null;throw e;});
  return fullBundlePromise;
}
async function range(m,d){
  if(fullBundle)return fullBundle.slice(d.offset,d.offset+d.length);
  try{
    const response=await fetchChecked(m.bundle+'?part='+d.offset,{headers:{Range:`bytes=${d.offset}-${d.offset+d.length-1}`}});
    const body=await response.arrayBuffer();
    if(response.status===200&&body.byteLength===m.bytes){fullBundle=body;return body.slice(d.offset,d.offset+d.length);}
    const expected=`bytes ${d.offset}-${d.offset+d.length-1}/${m.bytes}`;
    if(response.status!==206||response.headers.get('content-range')!==expected||body.byteLength!==d.length)throw Error('Range unsupported');
    return body;
  }catch(e){const body=await whole(m);return body.slice(d.offset,d.offset+d.length);}
}
async function assetBytes(path){
  const m=await manifest(),d=m.assets[path];if(!d)throw Error('Dataset unavailable: '+path);
  let part;
  // First request determines range support before parallel downloads begin.
  if(!probePromise){probePromise=range(m,d);try{part=await probePromise;}catch(e){probePromise=null;throw e;}}
  else{await probePromise;part=await range(m,d);}
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',part)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==d.sha256)throw Error('Atlas verification failed. Please try again.');
  const encoded=new TextDecoder().decode(part),compressed=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  return new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
async function load(path){
  if(path==='data/africa.geojson'||path==='data/kenya_boundary.geojson'){
    const overview=await (overviewPromise||(overviewPromise=fetchChecked('data/overview.json').then(r=>r.json()).catch(e=>{overviewPromise=null;throw e;})));
    return new TextEncoder().encode(JSON.stringify(path==='data/africa.geojson'?overview:{type:'FeatureCollection',features:overview.features.filter(f=>f.properties['ISO3166-1-Alpha-3']==='KEN')})).buffer;
  }
  const bytes=await assetBytes(path);
  if(path==='map-page.json'){
    const page=JSON.parse(new TextDecoder().decode(bytes));
    const old='countryLabels:()=>labels(DATA.countryLabels,"country-label"),';
    const fixed='countryLabels:()=>labels({type:"FeatureCollection",features:[...(DATA.countryLabels.features||[]),...((DATA.countryLabels.features||[]).some(f=>String(f.properties?.name||f.properties?.country).toLowerCase()==="kenya")?[]:[{type:"Feature",geometry:{type:"Point",coordinates:[37.9,0.5]},properties:{name:"Kenya",country:"Kenya"}}])]},"country-label"),';
    if(!page.html.includes(old))throw Error('The map template does not match this release.');
    page.html=page.html.replace(old,fixed);return new TextEncoder().encode(JSON.stringify(page)).buffer;
  }
  if(path==='analysis.html'||path==='donors.html'){
    const css=new URL('assets/section-tabs.css?v=20260916-2',root).href;
    const html=new TextDecoder().decode(bytes).replace('</head>',`<link rel="stylesheet" href="${css}"></head>`);
    return new TextEncoder().encode(html).buffer;
  }
  return bytes;
}
async function bytes(path){path=normalize(path);if(!decoded.has(path)){const p=load(path);decoded.set(path,p);p.catch(()=>decoded.delete(path));}return decoded.get(path);}
window.KenyaEmbedded={response:async p=>new Response(await bytes(p)),get:async(p,kind='json')=>new Response(await bytes(p))[kind]()};
})();
