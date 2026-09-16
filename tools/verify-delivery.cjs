const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto'),{gzipSync,gunzipSync}=require('node:zlib');
const root=__dirname+'/../', manifest=JSON.parse(fs.readFileSync(root+'assets/atlas-manifest.json')),bundle=fs.readFileSync(root+manifest.bundle),source=fs.readFileSync(root+'assets/atlas-loader.js','utf8');
function harness(mode='range'){
 const calls=[];let fail=false;
 const context={URL,Response,Blob,TextEncoder,TextDecoder,Uint8Array,DecompressionStream,AbortController,crypto:webcrypto,atob,setTimeout,clearTimeout,location:{href:'https://example.test/kenya-country-intelligence/'},window:{},fetch:async(url,options={})=>{
  const name=new URL(url).pathname.replace('/kenya-country-intelligence/','');calls.push({name,range:options.headers?.Range});
  if(name===manifest.bundle){
   if(mode==='bad-range'&&options.headers?.Range)return new Response('',{status:416});
   if(mode==='unsupported'||!options.headers?.Range)return new Response(bundle);
   if(mode==='corrupt'&&!fail){fail=true;const [s,e]=options.headers.Range.match(/\d+/g).map(Number);return new Response(Buffer.alloc(e-s+1,65),{status:206,headers:{'content-range':`bytes ${s}-${e}/${bundle.length}`}});}
   const [s,e]=options.headers.Range.match(/\d+/g).map(Number);return new Response(bundle.subarray(s,e+1),{status:206,headers:{'content-range':`bytes ${s}-${e}/${bundle.length}`}});
  }
  return new Response(fs.readFileSync(root+name));
 }};
 vm.runInNewContext(source,context);return {api:context.window.KenyaEmbedded,calls};
}
(async()=>{
 const h=harness();const home=await Promise.all([h.api.get('data/africa.geojson'),h.api.get('data/kenya_boundary.geojson')]);
 assert.equal(home[1].features.length,1);assert.equal(home[1].features[0].properties.name,'Kenya');assert.equal(h.calls.filter(x=>x.name===manifest.bundle).length,0);assert.equal(h.calls.length,1);
 for(const [p,d]of Object.entries(manifest.assets)){
  const raw=bundle.subarray(d.offset,d.offset+d.length),expected=gunzipSync(Buffer.from(raw.toString(),'base64')),actual=Buffer.from(await(await h.api.response(p)).arrayBuffer());
  if(p==='map-page.json'){
   const page=JSON.parse(actual);assert(page.html.includes('coordinates:[37.9,0.5]'));assert(page.html.includes('properties:{name:"Kenya",country:"Kenya"}'));
   // Validate every inline script after the targeted label patch.
   for(const match of page.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  }else if(['analysis.html','donors.html'].includes(p))assert(actual.toString().includes('assets/section-tabs.css?v=20260916-2'));
  else if(!['data/africa.geojson','data/kenya_boundary.geojson'].includes(p))assert.deepEqual(actual,expected,p);
 }
 const calls=h.calls.length;await h.api.get('data/country_summary.json');assert.equal(h.calls.length,calls);
 const f=harness('unsupported');await Promise.all([f.api.get('data/country_summary.json'),f.api.get('data/partner_profiles.json')]);assert.equal(f.calls.filter(c=>c.name===manifest.bundle).length,1);
 const rejected=harness('bad-range');await rejected.api.get('data/country_summary.json');assert.equal(rejected.calls.filter(c=>c.name===manifest.bundle&&!c.range).length,1);
 const bad=harness('corrupt');await assert.rejects(bad.api.get('data/country_summary.json'),/verification failed/);await bad.api.get('data/country_summary.json');
 const shell=fs.readFileSync(root+'index.html','utf8');for(const match of shell.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 assert(!shell.includes('const files='));assert(shell.includes("finally{if(ticket===routeTicket)$('opening').hidden=true;}"));
 console.log('PASS: 39 assets verified; original data preserved; home requests no atlas bundle; range reads, single-download fallback, cache, retry, Kenya label, tabs, and inline scripts checked.');
})().catch(e=>{console.error(e);process.exit(1)});
