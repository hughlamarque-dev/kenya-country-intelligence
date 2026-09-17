// Exercise actual download buttons; inspect XLSX contents separately with a reader.
const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path'),assert=require('assert'),zlib=require('zlib');
const root=path.resolve(__dirname,'..'),out=process.argv[2]||'/tmp/kenya-partner-export-design';fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/atlas-manifest.json'))),bundle=fs.readFileSync(path.join(root,manifest.bundle));
const requests=[],downloads=[],errors=[];
function dataset(p){requests.push(p);if(['data/funding-review-20260917.json','assets/partner-export-template.json'].includes(p))return JSON.parse(fs.readFileSync(path.join(root,p)));const a=manifest.assets[p];return JSON.parse(zlib.gunzipSync(Buffer.from(bundle.subarray(a.offset,a.offset+a.length).toString(),'base64')));}
const html=JSON.parse(fs.readFileSync(path.join(root,'pages/donors-20260917.json'))).html;
const dom=new JSDOM(html,{url:'https://hughlamarque-dev.github.io/kenya-country-intelligence/#donors',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,$=id=>d.getElementById(id);
w.Blob=Blob;w.TextEncoder=TextEncoder;w.fetch=async p=>({ok:true,json:async()=>dataset(p)});w.console.error=(...x)=>errors.push(x.join(' '));w.alert=x=>errors.push(x);
w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:download'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
let script=[...d.querySelectorAll('script')].at(-1).textContent;
// Test-only injection for XML edge cases, never present in the published page.
script=script.replace("$('loading').hidden=true;", "window.exportTest={partnerWorkbookEntries,partnerZip};$('loading').hidden=true;");w.eval(script);
const tick=()=>new Promise(r=>setTimeout(r,20));
async function ready(){for(let i=0;i<150&&$('app').hidden;i++)await tick();assert(!$('app').hidden,$('loading').textContent);}
const change=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new w.Event('change',{bubbles:true}));};
async function download(button,name){const n=downloads.length;button.click();for(let i=0;i<500&&downloads.length===n&&!errors.length;i++)await tick();assert.equal(errors.length,0,errors.join('\n'));assert.equal(downloads.length,n+1,$('partnerExportStatus').textContent);const bytes=Buffer.from(await downloads.at(-1).arrayBuffer());fs.writeFileSync(path.join(out,name+'.xlsx'),bytes);return bytes.length;}
(async()=>{
 await ready();assert(!$('partners').hidden);assert.deepEqual([...d.querySelectorAll('.primary-filters select')].map(e=>e.id),['sector','county']);assert(!requests.includes('assets/partner-export-template.json'),'Workbook must not load during page opening');
 $('exportShortlist').click();assert.equal(downloads.length,0);assert($('partnerExportStatus').textContent.includes('Save a partner'));
 const results={};
 change('sector','Education & skills');change('county','Kisii');const filteredNames=[...d.querySelectorAll('#routesGrid h3')].map(e=>e.textContent);assert(filteredNames.length>0);results.filtered=await download($('exportPartners'),'filtered');
 $('reset').click();change('routeStatus','open_call_verified');const routeNames=[...d.querySelectorAll('#routesGrid h3')].map(e=>e.textContent);assert(routeNames.length>0);results.routes=await download($('exportPartners'),'routes');
 const save=d.querySelector('#routesGrid [data-save]');save.click();const savedName=save.dataset.save;
 change('county','Kisii');change('sector','Education & skills');results.shortlist=await download($('exportShortlist'),'shortlist');
 $('reset').click();change('donor','Japan International Cooperation Agency (JICA)');const profile=d.querySelector('[data-reviewed-partner]');assert(profile);profile.click();results.individual=await download(d.querySelector('.partner-profile-export'),'individual');
 assert.equal(requests.filter(p=>p==='assets/partner-export-template.json').length,1,'Template should be cached after first export');
 const template=dataset('assets/partner-export-template.json'),fixture={'Partners':[{partner:'=2+2',role:'A & B <test>',checked:'2026-09-17'}],'Funding evidence':[{id:'negative',amount:-10},{id:'zero',amount:0},{id:'missing',amount:null},{id:'partial-date',start:'2020-02'}],'Sources':[{id:'X',url:'https://example.org/?x=1&y=2'}]};
 fs.writeFileSync(path.join(out,'edge-cases.xlsx'),Buffer.from(await w.exportTest.partnerZip(w.exportTest.partnerWorkbookEntries(template,fixture)).arrayBuffer()));
 fs.writeFileSync(path.join(out,'expected.json'),JSON.stringify({filteredNames,routeNames,savedName,results}));
 console.log(JSON.stringify({passed:true,filteredNames,routeNames,savedName,bytes:results,checks:['default partner tab','sector/geography only','empty shortlist','filter scope','application-route filter','shortlist ignores unrelated page filters','individual profile','lazy template load']}));w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
