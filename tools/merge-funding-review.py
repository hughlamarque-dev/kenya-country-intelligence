"""Consolidate the reviewed evidence; no documentary amounts enter IATI flows."""
import json,copy,collections,re,sys,base64,gzip
from pathlib import Path
R=Path(__file__).resolve().parents[1]
S=Path(sys.argv[1]) if len(sys.argv)>1 else R/'research/20260917'
if len(sys.argv)>2:D=json.loads(Path(sys.argv[2]).read_text())
else:
 m=json.loads((R/'assets/atlas-manifest.json').read_text());b=(R/m['bundle']).read_bytes();d=m['assets']['data/intelligence.json'];D=json.loads(gzip.decompress(base64.b64decode(b[d['offset']:d['offset']+d['length']])))
P={p['id']:p for p in D['projects']};orgs=[];records=[];gaps=[]
inputs=json.loads((S/'research-inputs.json').read_text())
for stream,d in sorted(inputs['streams'].items()):
 for o in d['organisations']:orgs.append(copy.deepcopy(o))
 for e in d['evidence']:
  e=copy.deepcopy(e);e['stream']=stream
  assert e['id'] and e['source_url'].startswith('https://'),e
  assert e['amount'] is None or isinstance(e['amount'],(int,float)),e['id']
  assert all(p in P for p in e['project_ids']),(e['id'],e['project_ids'])
  assert e['decision'] in ['include_reference','context_only','exclude'],e['id']
  records.append(e)
 for g in d.get('gaps',[]):gaps.append(dict(g,stream=stream) if isinstance(g,dict) else {'stream':stream,'finding':g})
# Consortium membership is not an identity alias. Mixed baseline donor labels remain distinct.
aliasowners=collections.defaultdict(set)
for o in orgs:
 for n in [o['name']]+o.get('aliases',[]):aliasowners[n].add(o['name'])
for o in orgs:
 aliases=o.get('aliases',[]);keep=[];associated=[]
 for n in aliases:
  bad=len(aliasowners[n])>1 or (o['name'] in ['UNDP','UNICEF','WFP','FAO','UNHCR','IOM','UNEP','UNESCO','ILO'] and (' / ' in n or 'consortium' in n.lower() or 'including ' in n)) or (o['name']=='Germany / BMZ' and n=='Germany / GIZ') or n=='SNV / GIZ'
  (associated if bad else keep).append(n)
 o['aliases']=keep
 if associated:o['associated_names']=associated
# Reviewed duplicates are the identical award, not different financial components.
duplicates={'europe_large-019':'UN-005','MC-016':'UN-011','MC-017':'UN-010'}
byid={e['id']:e for e in records};audit=[]
for dup,primary in duplicates.items():
 if dup not in byid:continue
 a,b=byid[dup],byid[primary]
 assert (a['amount'],a['currency'],a['project_ids'])==(b['amount'],b['currency'],b['project_ids'])
 b.setdefault('corroborating_sources',[]).append({'url':a['source_url'],'title':a['source_title'],'checked':a['accessed']})
 b.setdefault('related_organisations',[]).append(a['organisation'])
 audit.append({'excluded_reference':dup,'retained_reference':primary,'reason':'Same project, award amount, currency and financial event; corroborating source retained.'})
# Use source terminology instead of assuming contribution cash/commitment status.
if 'UN-001' in byid:
 byid['UN-001']['measure']='reported_contributions'
 byid['UN-001']['description']=byid['UN-001']['description'].replace('conservatively classified as contribution commitment, not confirmed disbursement.','retained as reported contributions with cash status unverified.')
refs=[e for e in records if e['id'] not in duplicates and e['decision']!='exclude']
for e in refs:e.pop('source_excerpt_short',None)
new_count=len(refs)
# Existing documented Japanese Embassy awards are retained once, with their original research date.
for i,b in enumerate(D['budgets']):
 p=P[b['project']]
 refs.append({'id':f'LEGACY-GGP-{i+1:03}','organisation':'Government of Japan — Embassy GGP','project_title':p['title'],'project_ids':[p['id']],'match_basis':'Existing documented grant matched in the original published dataset.','amount':b['amount'],'currency':b['currency'],'measure':'grant_award','geography_scope':'Kenya','kenya_amount_established':True,'period_start':p['start'],'period_end':p['end'],'amount_date':'','source_url':b['source'],'source_title':'Embassy of Japan — documented GGP award','source_date':'','accessed':b['as_of'],'source_locator':b['source_id'],'description':b['basis'],'counties':p['counties'],'county_allocation_established':False,'instrument':'Grant','cofinancing_note':'','overlap_warning':b['note']+' Excluded from IATI-flow totals.','confidence':'previously documented','decision':'include_reference','why':'Preserves original award evidence.','legacy':True})
# Only the three source-confirmed global/regional programme records are quarantined.
scope=inputs['scope_audit'];exclusions=[]
for x in scope['candidates']:
 if x['recommendation']=='quarantine_country_allocation':
  y={k:v for k,v in x.items() if k!='flow_rows'};y['excluded_rows']=len(x['flow_rows']);y['usd_by_measure']=dict((m,sum(f['usd'] for f in x['flow_rows'] if f['type']==m)) for m in set(f['type'] for f in x['flow_rows']));exclusions.append(y)
assert {x['activity_id'] for x in exclusions}=={'41AAA-24837-001','41AAA-24181-001','41AAA-24039-001'}
excluded_ids={x['activity_id'] for x in exclusions};ef=[f for f in D['flows'] if f['aid'] in excluded_ids]
# Coverage includes established monetary references only; wider or proposed envelopes do not fill a gap.
qualifying=[e for e in refs if e['decision']=='include_reference' and e['kenya_amount_established'] and e['amount'] is not None]
new_project_ids={p for e in qualifying if not e.get('legacy') for p in e['project_ids']}
old_covered={p['id'] for p in D['projects'] if p['iati_ids']}|{b['project'] for b in D['budgets']}
all_covered=old_covered|{p for e in qualifying for p in e['project_ids']}
register=inputs['organisation_register'];identity={n:o for o in orgs for n in [o['name']]+o['aliases']}
for row in register:
 o=identity.get(row['organisation']);row['organisation_profile_reviewed']=bool(o)
 row['review_status']='organisation_profile_reviewed; project coverage partial' if o else 'not_yet_reviewed'
 row['projects_with_new_documentary_amount']=sum(p['organisation']==row['organisation'] for id,p in P.items() if id in new_project_ids)
 if o:row.update({'reviewed_name':o['name'],'role':o['role'],'access_route':o['access_route'],'opportunity_status':o['opportunity_status']})
# Source-backed distinction: old broad Japan/JICA tag covered Embassy grants.
corrections=[{'project_id':b['project'],'donors':['Government of Japan — Embassy GGP'],'reason':'Original funding evidence is an Embassy GGP award, not JICA financing.','source':b['source']} for b in D['budgets']]
meta={'checked':'2026-09-17','iati_asof':D['meta']['asof'],'organisations_reviewed':len(orgs),'baseline_organisation_labels':len(register),'new_reference_records':new_count,'new_kenya_amount_references':sum(not e.get('legacy') for e in qualifying),'new_context_records':sum(e['decision']=='context_only' for e in refs),'prior_reference_records':len(D['budgets']),'existing_projects_with_new_amount_references':len(new_project_ids),'previously_unmatched_projects_with_new_amount':len(new_project_ids-old_covered),'project_evidence_count':len(all_covered),'projects_without_amount_evidence':len(P)-len(all_covered),'excluded_flow_rows':len(ef),'excluded_flow_usd':sum(f['usd'] for f in ef),'duplicate_references_removed':len(audit)}
meta['corrected_activity_descriptions']=len(inputs.get('activity_corrections',[]))
out={'activity_corrections':inputs.get('activity_corrections',[]),'meta':meta,'organisations':orgs,'evidence':refs,'register':register,'gaps':gaps,'ledger_exclusions':exclusions,'duplicate_audit':audit,'project_corrections':corrections,'scope_limit':'Staged review of selected organisations and projects, not a census of all source organisation labels. References are not added to flow totals.'}
(R/'data/funding-review-20260917.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,indent=2))
