// Runs in the donor application's closure. The template loads only on export.
let partnerTemplatePromise;
const exportText=v=>Array.isArray(v)?v.filter(x=>x!=null&&x!=='').join('; '):String(v??'');
const exportXml=v=>exportText(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const exportColumn=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
const safeExportUrl=v=>/^https?:\/\/[^\s]+$/i.test(String(v||''))?String(v):'';
function partnerExportData(inputNames,filtered){
 const names=[...new Set(inputNames.map(canon))].sort((a,b)=>a.localeCompare(b)),has=ns=>ns.some(n=>names.some(name=>samePartner(n,name)));
 const data={'Partners':[],'Calls and routes':[],'Projects':[],'Funding evidence':[],'Financial history':[],'Sources':[],'Export details':[]}, sourceMap=new Map();
 function sources(items,subject,checked){return (items||[]).map(item=>{
   const s=typeof item==='string'?{url:item}:item,url=safeExportUrl(s.url||s.source_url);if(!url)return '';
   const row={subject,title:s.title||s.source_title||subject,url,date:s.source_date||s.date||'',checked:s.accessed||s.checked||checked||''},key=JSON.stringify(row);
   if(!sourceMap.has(key)){const id='S'+String(sourceMap.size+1).padStart(5,'0');sourceMap.set(key,id);data.Sources.push({id,...row});}return sourceMap.get(key);
 }).filter(Boolean).join('; ');}
 const projectNames=p=>[p.organisation,...(p.donors||[]),...(p.iati_ids||[]).flatMap(id=>{const a=A.get(id);return a?[a.organisation,...(a.donors||[])]:[];})];
 const projects=(filtered?selectedProjects:D.projects).filter(p=>has(projectNames(p)));
 const evidence=references.filter(e=>has([e.organisation,...(e.related_organisations||[]),...(e.funders||[]),...(e.project_ids||[]).flatMap(id=>{const p=P.get(id);return p?projectNames(p):[];})])&&(!filtered||referenceMatches(e)));
 const flows=(filtered?selectedFlows:D.flows).filter(f=>{const a=A.get(f.aid);return a&&!a.quarantined&&has([a.organisation,...(a.donors||[])]);});
 for(const name of names){
   const o=profileFor(name),legacy=profiles[name]||Object.entries(profiles).find(([k])=>samePartner(k,name))?.[1],checked=o?research.meta.checked:(legacy?D.meta.asof:'');
   const urls=sources(o?.sources||legacy?.sources,name,checked);
   data.Partners.push({partner:name,role:roleLabels[o?.role]||o?.role||'Not reviewed',sectors:o?.sectors||[],approach:o?.approach||legacy?.note||'Not reported',finding:o?.finding||'Current funding route has not been reviewed.',review:o?.review_status||'Not reviewed',checked,sources:urls});
   data['Calls and routes'].push({partner:name,status:opportunityLabels[o?.opportunity_status]||'Current route not established',route:o?.access_route||legacy?.route||'Not reported',eligibility:o?.eligibility||'Not reported',size:o?.ticket_size||'Not separately recorded — see route and sources',deadline:o?.deadline||'Not separately recorded — see route and sources',checked:o?.route_checked||checked,url:safeExportUrl(o?.route_url),sources:urls});
 }
 for(const p of projects){
   const matched=names.filter(n=>projectNames(p).some(x=>samePartner(x,n))).map(n=>{
     const roles=[];if(samePartner(p.organisation,n))roles.push('implementing / reporting organisation');if((p.donors||[]).some(x=>samePartner(x,n)))roles.push('reported funder');if(!roles.length)roles.push('linked financial activity');return n+' — '+roles.join(', ');
   });
   data.Projects.push({id:p.id,title:p.title,matched,organisation:p.organisation,donors:p.donors,sectors:p.sectors,counties:p.counties,start:p.start,end:p.end,status:p.status,description:p.description,caveats:p.caveats,checked:p.checked,sources:sources(p.sources,p.id+' · '+p.title,p.checked)});
 }
 for(const e of evidence)data['Funding evidence'].push({id:e.id,partner:e.organisation,title:e.project_title,amount:e.amount,currency:e.currency,measure:measureLabels[e.measure]||e.measure,instrument:e.instrument,scope:e.geography_scope,kenya:e.kenya_amount_established?'Yes':'No — context only',start:e.period_start,end:e.period_end,amountDate:e.amount_date,description:exportText([e.description||e.why,e.decision==='context_only'?'Context only':'',e.confidence?'Evidence status: '+e.confidence:'']),allocation:e.county_allocation_established?'Source assigns the amount to: '+exportText(e.counties):'County association only; no county spending allocation established.',overlap:exportText([e.overlap_warning,e.cofinancing_note]),projects:e.project_ids,checked:e.accessed,sources:sources([{url:e.source_url,title:e.source_title,source_date:e.source_date,accessed:e.accessed}],e.id+' · '+e.project_title,e.accessed)});
 const flowLabels={IF:'Incoming funds',C:'Commitments',D:'Disbursements',E:'Expenditure',IR:'Interest repayment',LR:'Loan repayment',R:'Reimbursement',IE:'Interest',DPE:'Debt relief',OS:'Outgoing pledge',IS:'Incoming pledge'};
 for(const f of flows){const a=A.get(f.aid);data['Financial history'].push({id:a.id,title:a.title,partner:a.organisation,year:f.year,measure:flowLabels[f.type]||f.type,usd:f.usd,original:f.original,currency:f.currency,instrument:f.instrument,basis:f.basis||a.country_basis,counties:a.counties,allocation:'Kenya-attributable activity; no county spending allocation.',lastDate:f.last_date,checked:D.meta.asof,sources:sources([{url:a.source,title:a.title,source_date:a.updated}],a.id,D.meta.asof)});}
 const details={
  'Export':'Kenya donor intelligence · '+new Date().toISOString(),
  'Scope':filtered?'Reviewed partners matching the current filters. Supporting projects, documentary evidence and financial history follow their corresponding page filters.':'Selected partners, with all available supporting periods and financial measures. Page filters do not restrict a saved-shortlist or individual-partner workbook.',
  'Partners':names.join('; '),
  'Selection':filtered?[state.sector||'All sectors',state.county||'All Kenya geographies',state.search?'Search: '+state.search:'',state.donor?'Partner: '+state.donor:'',state.from+'–'+state.to,$('measure').selectedOptions[0].textContent,state.instrument,state.coverage==='matched'?'Only activities linked to researched projects':'',opportunityLabels[$('routeStatus').value],roleLabels[$('partnerRole').value]].filter(Boolean).join(' · '):'Saved shortlist / individual partner; all available evidence',
  'Partner relevance':'A partner can match its stated priorities or an associated project. A match is a research lead; read the profile and linked sources to assess fit.',
  'Application status':'Status, eligibility and dates are recorded as reviewed. Consult the official source for current terms. Where no separate deadline or size field was recorded, consult the complete route description and sources.',
  'Amounts':'Documentary awards, budgets and financing decisions remain in their original currencies. Financial history contains reported annual flows; measures are not added together.',
  'Reporting chains':'A financial activity can be linked through its reporter or named funder. Reporting partner identifies the publisher. Funder transfers and implementer expenditure may describe the same money.',
  'Country and county scope':D.meta.county_note||'County relevance identifies associated projects. Kenya-wide funding is never assigned in full to a county.',
  'USD conversions':D.meta.currency_note||'USD conversions as reported by the financial source; no new exchange rates applied.',
  'Coverage':D.meta.finance_note||'Reported records are incomplete and are not a reconciled national aid total.',
  'Financial records checked':D.meta.asof,
  'Organisation review checked':research.meta.checked,
  'Dates':'Partial source dates remain partial; missing dates are blank. No day or deadline has been inferred.',
  'Sources':'Source IDs link each row to Sources, which contains clickable URLs and review dates.',
  'Records':Object.entries(data).filter(([n])=>n!=='Export details').map(([n,rows])=>n+': '+rows.length).join('; ')
 };
 data['Export details']=Object.entries(details).map(([item,detail])=>({item,detail}));return data;
}
function partnerWorkbookEntries(template,data){
 const entries={...template.entries};
 for(const spec of template.sheets){
  const rows=data[spec.name]||[],links=[],n=spec.columns.length,last=exportColumn(n-1),ns='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  function cell(value,r,i,style,type){const ref=exportColumn(i)+r;
   if(value==null||value==='')return '<x:c r="'+ref+'" s="'+style+'"/>';
   if((type==='number'||type==='integer')&&Number.isFinite(Number(value)))return '<x:c r="'+ref+'" s="'+style+'" t="n"><x:v>'+Number(value)+'</x:v></x:c>';
   if(type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))){const serial=(Date.parse(value+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;return '<x:c r="'+ref+'" s="'+style+'" t="n"><x:v>'+serial+'</x:v></x:c>';}
   if(type==='url'&&safeExportUrl(value))links.push({ref,url:String(value)});
   const text=exportText(value);if(text.length>32767)throw Error('A source field exceeds the Excel cell limit; export could not preserve it in full.');
   return '<x:c r="'+ref+'" s="'+style+'" t="inlineStr"><x:is><x:t xml:space="preserve">'+exportXml(text)+'</x:t></x:is></x:c>';
  }
  let sheetData='<x:sheetData><x:row r="2" ht="28" customHeight="1">'+cell(spec.title,2,0,spec.styles.title)+'</x:row><x:row r="3" ht="24" customHeight="1">'+cell('Kenya donor intelligence · '+rows.length+' records · '+new Date().toISOString().slice(0,10),3,0,spec.styles.subtitle)+'</x:row><x:row r="5" ht="40" customHeight="1">'+spec.columns.map((c,i)=>cell(c[1],5,i,spec.styles.header)).join('')+'</x:row>';
  rows.forEach((row,j)=>{const r=j+6;const lines=Math.max(...spec.columns.map(c=>exportText(row[c[0]]).split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/Math.max(8,c[2]*.8))),0)));const height=Math.min(409,Math.max(34,lines*15+12));sheetData+='<x:row r="'+r+'" ht="'+height+'" customHeight="1">'+spec.columns.map((c,i)=>cell(row[c[0]],r,i,spec.styles.body[i],c[3])).join('')+'</x:row>';});
  sheetData+='</x:sheetData>';
  const titleLast=exportColumn(Math.min(n-1,3));
  const merged='<x:mergeCells count="2"><x:mergeCell ref="A2:'+titleLast+'2"/><x:mergeCell ref="A3:'+titleLast+'3"/></x:mergeCells>';
  const linkXml=links.length?'<x:hyperlinks>'+links.map((l,i)=>'<x:hyperlink ref="'+l.ref+'" r:id="rId'+(i+1)+'"/>').join('')+'</x:hyperlinks>':'';
  entries[spec.path]=entries[spec.path].replace('<x:worksheet ', '<x:worksheet xmlns:r="'+ns+'" ').replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/,sheetData+'<x:autoFilter ref="A5:'+last+Math.max(5,rows.length+5)+'"/>'+merged+linkXml);
  if(links.length){const relPath=spec.path.replace(/([^/]+)$/,'_rels/$1.rels');entries[relPath]='<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+links.map((l,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+ns+'/hyperlink" Target="'+exportXml(l.url)+'" TargetMode="External"/>').join('')+'</Relationships>';}
 }
 return entries;
}
// Standard uncompressed ZIP: small, dependency-free and readable by Excel/LibreOffice.
function partnerZip(entries){
 const encoder=new TextEncoder(),chunks=[],central=[],crcTable=new Uint32Array(256);let offset=0;
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
 function header(size){const b=new Uint8Array(size);return {b,v:new DataView(b.buffer)};}
 for(const [path,text] of Object.entries(entries)){
  const name=encoder.encode(path),body=encoder.encode(text);let crc=0xffffffff;for(const b of body)crc=crcTable[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const h=header(30);h.v.setUint32(0,0x04034b50,true);h.v.setUint16(4,20,true);h.v.setUint16(6,0x800,true);h.v.setUint16(12,33,true);h.v.setUint32(14,crc,true);h.v.setUint32(18,body.length,true);h.v.setUint32(22,body.length,true);h.v.setUint16(26,name.length,true);chunks.push(h.b,name,body);
  const c=header(46);c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);c.v.setUint16(6,20,true);c.v.setUint16(8,0x800,true);c.v.setUint16(14,33,true);c.v.setUint32(16,crc,true);c.v.setUint32(20,body.length,true);c.v.setUint32(24,body.length,true);c.v.setUint16(28,name.length,true);c.v.setUint32(42,offset,true);central.push(c.b,name);offset+=30+name.length+body.length;
 }
 const centralSize=central.reduce((s,b)=>s+b.length,0),end=header(22),count=Object.keys(entries).length;end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,count,true);end.v.setUint16(10,count,true);end.v.setUint32(12,centralSize,true);end.v.setUint32(16,offset,true);
 return new Blob([...chunks,...central,end.b],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function exportPartners(names,filtered,button){
 const status=$('partnerExportStatus'),label=button.textContent;if(!names.length){status.textContent=filtered?'No reviewed partners match these filters.':'Save a partner to your shortlist first.';return;}
 button.disabled=true;button.textContent='Preparing Excel…';status.textContent='Preparing profiles, routes and supporting evidence…';
 try{
  const data=partnerExportData(names,filtered);
  const template=await (partnerTemplatePromise||(partnerTemplatePromise=get('assets/partner-export-template.json').catch(e=>{partnerTemplatePromise=null;throw e;})));
  const blob=partnerZip(partnerWorkbookEntries(template,data)),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Kenya_'+(filtered?'filtered_partners':names.length===1?'partner_'+canon(names[0]).replace(/[^\p{L}\p{N}]+/gu,'_').slice(0,60):'saved_partners')+'_'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='Downloaded '+data.Partners.length+' partner'+(data.Partners.length===1?'':'s')+' with routes, projects, funding evidence and sources.';
 }catch(e){console.error(e);status.textContent='Export could not complete. '+e.message+' Please try again.';}finally{button.disabled=false;button.textContent=label;}
}
const csvShortlist=$('exportShortlist').onclick;
$('exportShortlistCsv').onclick=csvShortlist;
$('exportShortlist').textContent='Saved shortlist (Excel)';
$('exportShortlist').onclick=e=>exportPartners([...saved],false,e.currentTarget);
$('exportPartners').onclick=e=>exportPartners(filteredReviewedPartners().map(o=>o.name),true,e.currentTarget);
function addPartnerExport(name){const b=document.createElement('button');b.className='partner-profile-export';b.textContent='Export this partner (Excel)';b.onclick=()=>exportPartners([name],false,b);$('detailContent').prepend(b);}
const reviewedBeforeExport=openReviewedPartner;openReviewedPartner=function(name){reviewedBeforeExport(name);if(profileFor(name))addPartnerExport(name);};
const profileBeforeExport=partnerDetail;partnerDetail=function(name){profileBeforeExport(name);addPartnerExport(name);};
