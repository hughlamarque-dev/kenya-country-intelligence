// Runs within the donor page's existing application closure.
const research=await get('data/funding-review-20260917.json');
const reviewedOrganisations=research.organisations||[], references=research.evidence||[];
const activityCorrections=new Map((research.activity_corrections||[]).map(c=>[c.activity_id,c]));for(const [id,c] of activityCorrections){const a=A.get(id);if(a){if(c.description)a.description=c.description;if(c.sector)a.sector=c.sector;}}

const docsByProject=new Map();for(const e of references)for(const id of e.project_ids||[])docsByProject.set(id,(docsByProject.get(id)||0)+1);
for(const correction of research.project_corrections||[]){const p=P.get(correction.project_id);if(p&&correction.donors)p.donors=correction.donors;}

const reviewByName=new Map();
for(const o of reviewedOrganisations)for(const n of [o.name,...(o.aliases||[])])if(!reviewByName.has(n))reviewByName.set(n,o);
const profileFor=n=>reviewByName.get(n), canon=n=>profileFor(n)?.name||n;
const samePartner=(a,b)=>a===b||canon(a)===canon(b);
const excludedActivities=new Set((research.ledger_exclusions||[]).map(x=>x.activity_id));
D.flows=D.flows.filter(f=>!excludedActivities.has(f.aid));
$('coverageText').textContent+=' Supplementary scope review removes '+(research.ledger_exclusions||[]).length+' activities / '+research.meta.excluded_flow_rows+' annual rows from this display; original source data remains in the audit trail.';
let referencePage=0,partnerLimit=48;
const roleLabels={funder:'Funding organisation',implementer:'Implementing organisation',financing_institution:'Development finance institution',pooled_fund:'Pooled fund',mixed:'Several financing / delivery roles'};
const opportunityLabels={open_call_verified:'Application window verified',standing_route_verified:'Published application route',no_open_call_verified:'No open call verified',restricted_or_invitation:'Restricted / invitation route',unknown:'Current route not established'};
const measureLabels={approved_financing:'Approved financing',grant_award:'Grant award',project_budget:'Project budget',commitment:'Commitment',disbursement:'Disbursement',expenditure:'Expenditure',reported_contributions:'Reported contributions (cash status unverified)',received_contribution:'Received contributions',funding_requirement:'Funding requirement',strategy_envelope:'Strategy envelope',mobilisation_target:'Mobilisation target',unallocated_regional_envelope:'Regional envelope'};
const originalAmount=e=>e.amount==null?'Amount not established':esc(e.currency)+' '+Number(e.amount).toLocaleString('en-GB',{maximumFractionDigits:2});
function referenceMatches(e){
 const ps=(e.project_ids||[]).map(id=>P.get(id)).filter(Boolean), names=[e.organisation,...(e.related_organisations||[]),...(e.funders||[]),...ps.flatMap(p=>[p.organisation,...p.donors])];
 if(state.donor&&!names.some(n=>samePartner(n,state.donor)))return false;
 if(state.county&&![...(e.counties||[]),...ps.flatMap(p=>p.counties)].includes(state.county))return false;
 if(state.sector&&![...(e.sectors||[]),...ps.flatMap(p=>p.sectors)].includes(state.sector))return false;
 const q=state.search.toLowerCase();if(q&&![e.project_title,e.organisation,e.description,...names].join(' ').toLowerCase().includes(q))return false;
 const start=String(e.period_start||e.amount_date||e.source_date||'').slice(0,4),end=String(e.period_end||(e.period_start?'':e.amount_date||e.source_date||'')).slice(0,4);
 if(/^\d{4}$/.test(start)&&+start>state.to)return false;if(/^\d{4}$/.test(end)&&+end<state.from)return false;
 return true;
}
function evidenceHtml(rows){return rows.map(e=>'<article class="funding-evidence"><div class="card-header"><h3>'+esc(e.project_title)+'</h3><strong>'+originalAmount(e)+'</strong></div><p class="small"><b>'+esc(measureLabels[e.measure]||e.measure)+'</b> · '+esc(e.instrument||'Instrument unreported')+' · '+esc(e.organisation)+' · '+esc(e.geography_scope)+(e.period_start||e.period_end?' · '+esc([e.period_start||'Not reported',e.period_end||'Not reported'].join(' – ')):'')+'</p><p>'+esc(e.description||e.why||'')+'</p><p class="small">'+esc(e.cofinancing_note||'')+'</p><p class="small">'+esc(e.overlap_warning||'Reference amount only; excluded from financial-flow totals.')+'</p>'+(!e.kenya_amount_established?'<p class="scope-note">A separate Kenya amount has not been established. This is contextual evidence.</p>':'')+'<p class="small">'+esc(e.county_allocation_established?'Source explicitly assigns this amount to the stated county.':'County relevance does not establish a county spending allocation.')+'</p><a class="source" href="'+esc(e.source_url)+'" target="_blank" rel="noopener">'+esc(e.source_title||'Official funding source')+' ↗</a><p class="small">Source date: '+esc(e.source_date||'Not published')+' · Checked: '+esc(e.accessed)+' · '+esc(e.confidence)+(e.decision==='context_only'?' · Context only':'')+(e.legacy?' · Previous research':'')+'</p></article>').join('')||'<p class="empty">No documentary amount matches this selection. Missing evidence does not mean no funding.</p>';}
function renderReferenceEvidence(){
 const rows=references.filter(referenceMatches),type=$('evidenceType').value,keOnly=$('kenyaOnly').checked;
 const filtered=rows.filter(e=>(!type||e.measure===type)&&(!keOnly||e.kenya_amount_established));
 const max=Math.max(1,Math.ceil(filtered.length/10));referencePage=Math.min(referencePage,max-1);
 $('referenceCount').textContent=filtered.length+' documentary records match partner, sector, county and overlapping year filters. Financial-measure, instrument and IATI-coverage controls apply to the history above. Amounts below are not added together. Records with unknown end dates may remain visible; check their source periods.';
 $('budgetTable').innerHTML=evidenceHtml(filtered.slice(referencePage*10,referencePage*10+10));
 $('referencePagination').textContent='Page '+(referencePage+1)+' of '+max;$('referencePrevious').disabled=referencePage===0;$('referenceNext').disabled=referencePage>=max-1;
 $('exportEvidence').onclick=()=>csvFile('Kenya_documented_funding_evidence.csv',filtered.map(e=>({...e,project_ids:e.project_ids,source_url:e.source_url})));
}
function routeHtml(o){if(!o)return '<p class="small">Current funding route has not been reviewed.</p>';
 return '<section class="partner-route"><h3>Role and route</h3><p><span class="review-badge">'+esc(roleLabels[o.role]||o.role)+'</span> <span class="review-badge">'+esc(opportunityLabels[o.opportunity_status]||'Current route not established')+'</span></p><p>'+esc(o.access_route||'Route not established.')+'</p>'+(o.eligibility?'<p><b>Eligibility:</b> '+esc(o.eligibility)+'</p>':'')+(o.ticket_size?'<p><b>Published size:</b> '+esc(o.ticket_size)+'</p>':'')+(o.deadline?'<p><b>Deadline:</b> '+esc(o.deadline)+'</p>':'')+'<p class="small">'+esc(o.approach||'')+'</p><p class="small">Review: '+esc(o.review_status)+' · Checked '+esc(research.meta.checked)+'. Verify eligibility and any deadline on the official page before approaching.</p>'+(o.sources||[]).map(s=>'<a class="source" href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+' ↗</a>').join('')+'</section>';
}
function reviewSummary(){
 const total=sum(selectedFlows.map(f=>f.usd)),unknown=sum(selectedFlows.filter(f=>A.get(f.aid)?.sector==='Other / unspecified').map(f=>f.usd));
 $('reviewCoverage').textContent='Evidence review: '+research.meta.checked+' · '+reviewedOrganisations.length+' organisations reviewed · '+research.meta.new_kenya_amount_references+' Kenya amount records and '+research.meta.new_context_records+' contextual records added. Historical IATI data checked '+D.meta.asof+'. This is a staged review; unreviewed organisations remain in the register.';
 $('sectorCoverage').textContent='Specific principal sector not reported: '+short(unknown)+(total>0?' ('+Math.round(unknown/total*100)+'% of this selection)':'')+'. The sector comparison is incomplete.';
 $('researchStatus').textContent=research.meta.project_evidence_count+' researched projects have linked financial or documentary amount evidence; '+research.meta.projects_without_amount_evidence+' remain without it. A match may cover a wider programme and does not establish a local allocation.';
}
function renderRoutes(){
 const q=state.search.toLowerCase(),status=$('routeStatus').value,role=$('partnerRole').value;
 const rows=reviewedOrganisations.filter(o=>{
   if(status&&o.opportunity_status!==status)return false;if(role&&o.role!==role)return false;
   if(state.donor&&!samePartner(o.name,state.donor))return false;
   const ps=D.projects.filter(p=>[p.organisation,...p.donors].some(n=>samePartner(n,o.name))&&overlap(p));
   if(state.county&&!ps.some(p=>p.counties.includes(state.county))&&!references.some(e=>samePartner(e.organisation,o.name)&&referenceMatches(e)))return false;
   if(state.sector&&!(o.sectors||[]).includes(state.sector)&&!ps.some(p=>p.sectors.includes(state.sector)))return false;
   return !q||[o.name,...(o.aliases||[]),o.approach,o.access_route,...(o.sectors||[])].join(' ').toLowerCase().includes(q)||ps.some(p=>[p.title,p.description].join(' ').toLowerCase().includes(q));
 });
 $('routeCount').textContent=rows.length+' reviewed organisations match. These are access-route findings, not predicted funding chances. Strategy fit and project experience are different forms of evidence.';
 $('routesGrid').innerHTML=rows.map(o=>'<article class="card"><h3>'+esc(o.name)+'</h3><p><span class="review-badge">'+esc(roleLabels[o.role]||o.role)+'</span> <span class="review-badge">'+esc(opportunityLabels[o.opportunity_status]||'Current route not established')+'</span></p><p>'+esc(o.access_route||o.finding)+'</p><p class="small">'+esc((o.sectors||[]).join(' · '))+'</p><div class="actions"><button data-reviewed-partner="'+esc(o.name)+'">Route & evidence</button><button data-save="'+esc(o.name)+'">'+(saved.has(o.name)?'Saved ✓':'Shortlist +')+'</button></div></article>').join('')||'<p class="empty">No reviewed route matches these filters. Historical portfolios remain below.</p>';
}
function openReviewedPartner(name){const o=profileFor(name);if(!o)return;const rows=references.filter(e=>samePartner(e.organisation,name)||(e.project_ids||[]).some(id=>{const p=P.get(id);return p&&[p.organisation,...p.donors].some(n=>samePartner(n,name));}));openDetail('<h1>'+esc(o.name)+'</h1>'+routeHtml(o)+'<h3>What the review established</h3><p>'+esc(o.finding)+'</p><h2>Documentary funding evidence</h2><p class="small">These records may pre-date the year selection. Check periods and instrument. They are excluded from IATI-flow totals.</p>'+evidenceHtml(rows));}
const oldActivityHtml=activityHtml;activityHtml=function(a){const c=activityCorrections.get(a.id);return oldActivityHtml(a)+(c?'<p class=\"scope-note\">'+esc(c.reason)+' <a href=\"'+esc(c.source_url)+'\" target=\"_blank\" rel=\"noopener\">Verified project evidence ↗</a></p>':'');};
const oldFunding=funding;funding=function(){oldFunding();renderReferenceEvidence();};
const oldPartners=partners;partners=function(){oldPartners();renderRoutes();$('morePartners').hidden=partnerRows().length<=partnerLimit;};
const oldRender=render;render=function(){oldRender();reviewSummary();$('scope').textContent+=' Reporting chains may still overlap; this is not a consolidated net-aid total.';};
const oldProjectDetail=projectDetail;projectDetail=function(id){oldProjectDetail(id);const rows=references.filter(e=>(e.project_ids||[]).includes(id));const box=document.createElement('section');box.innerHTML='<h2>Documentary amounts</h2><p class="small">All available reference periods are shown below, separately from IATI transactions.</p>'+evidenceHtml(rows);$('detailContent').appendChild(box);};
const oldPartnerDetail=partnerDetail;partnerDetail=function(name){oldPartnerDetail(name);const o=profileFor(name);if(o){const section=document.createElement('section');section.innerHTML=routeHtml(o);$('detailContent').prepend(section);}const rows=references.filter(e=>samePartner(e.organisation,name)||(e.project_ids||[]).some(id=>{const p=P.get(id);return p&&[p.organisation,...p.donors].some(n=>samePartner(n,name));}));if(rows.length){const section=document.createElement('section');section.innerHTML='<h2>Documentary amounts</h2>'+evidenceHtml(rows);$('detailContent').appendChild(section);}};
for(const o of reviewedOrganisations)if(![...$('donor').options].some(x=>x.value===o.name))$('donor').add(new Option(o.name,o.name));
for(const v of unique(references.map(e=>e.measure)).sort())$('evidenceType').add(new Option(measureLabels[v]||v,v));
$('evidenceType').onchange=$('kenyaOnly').onchange=()=>{referencePage=0;renderReferenceEvidence();};$('referencePrevious').onclick=()=>{referencePage--;renderReferenceEvidence();};$('referenceNext').onclick=()=>{referencePage++;renderReferenceEvidence();};
$('routeStatus').onchange=$('partnerRole').onchange=renderRoutes;$('morePartners').onclick=()=>{partnerLimit+=48;partners();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-reviewed-partner]');if(b){e.preventDefault();openReviewedPartner(b.dataset.reviewedPartner);}});
$('exportShortlist').onclick=()=>csvFile('Kenya_donor_shortlist.csv',[...saved].map(name=>{const o=profileFor(name);return {partner:name,role:o?.role||'Not reviewed',access_route:o?.access_route||'',opportunity_status:o?.opportunity_status||'unknown',eligibility:o?.eligibility||'',deadline:o?.deadline||'',design_notes:o?.approach||profiles[name]?.route||'',sector_filter:state.sector,county_filter:state.county,selected_years:state.from+'-'+state.to,sources:o?.sources?.map(s=>s.url)||profiles[name]?.sources?.map(s=>s.url)||[],checked:o?research.meta.checked:D.meta.asof};}));
$('exportRegister').onclick=()=>csvFile('Kenya_organisation_review_register.csv',research.register||[]);
$('exportExclusions').onclick=()=>csvFile('Kenya_additional_scope_exclusions.csv',research.ledger_exclusions||[]);

$('exportGaps').onclick=()=>csvFile('Kenya_funding_research_gaps.csv',research.gaps||[]);

$('donor').value=state.donor;const originalReset=$('reset').onclick;$('reset').onclick=()=>{$('routeStatus').value='';$('partnerRole').value='';$('evidenceType').value='';$('kenyaOnly').checked=true;referencePage=0;originalReset();};

$('exportCorrections').onclick=()=>csvFile('Kenya_activity_description_corrections.csv',research.activity_corrections||[]);
