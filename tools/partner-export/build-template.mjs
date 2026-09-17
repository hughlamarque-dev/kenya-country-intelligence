import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const out=process.argv[2];
if(!out)throw Error('Usage: node build-template.mjs OUTPUT_DIRECTORY');
await fs.mkdir(out,{recursive:true});
const specs=[
 {name:'Partners',title:'Potential partners',columns:[['partner','Partner',38],['role','Organisation role',26],['sectors','Priority sectors',42],['approach','Programme approach',74],['finding','Evidence reviewed',74],['review','Review status',18],['checked','Checked',16,'date'],['sources','Source IDs',24]]},
 {name:'Calls and routes',title:'Funding calls and partnership routes',columns:[['partner','Partner',38],['status','Status at review',30],['route','Call or application route',76],['eligibility','Eligibility',68],['size','Published funding size',44],['deadline','Deadline as reported',32],['checked','Checked',16,'date'],['url','Application or route URL',65,'url'],['sources','Source IDs',24]]},
 {name:'Projects',title:'Related development projects',columns:[['id','Project ID',19],['title','Project',65],['matched','Exported partner relationship',40],['organisation','Implementing / reporting organisation',38],['donors','Reported funders',44],['sectors','Sectors',35],['counties','Geography',42],['start','Reported start',18,'date'],['end','Reported end',18,'date'],['status','Reported status',23],['description','Description',80],['caveats','Geographic and source notes',70],['checked','Checked',16,'date'],['sources','Source IDs',25]]},
 {name:'Funding evidence',title:'Documented funding amounts',columns:[['id','Evidence ID',22],['partner','Source organisation',40],['title','Project or programme',65],['amount','Original amount',21,'number'],['currency','Currency',13],['measure','Financial measure',36],['instrument','Instrument',25],['scope','Geographic scope',26],['kenya','Kenya amount established',22],['start','Period start',18,'date'],['end','Period end',18,'date'],['amountDate','Amount date',18,'date'],['description','Source finding',80],['allocation','County allocation',52],['overlap','Overlap and co-financing notes',76],['projects','Linked project IDs',32],['checked','Checked',16,'date'],['sources','Source IDs',25]]},
 {name:'Financial history',title:'Reported annual financial records',columns:[['id','Activity ID',42],['title','Activity',65],['partner','Reporting partner',42],['year','Year',12,'integer'],['measure','Financial measure',28],['usd','Kenya-attributable amount (USD)',24,'number'],['original','Original reported amount',24,'number'],['currency','Original currency',16],['instrument','Instrument',27],['basis','Kenya attribution basis',54],['counties','Associated counties',48],['allocation','County allocation',44],['lastDate','Latest transaction date',21,'date'],['checked','Checked',16,'date'],['sources','Source IDs',25]]},
 {name:'Sources',title:'Sources and review dates',columns:[['id','Source ID',16],['subject','Partner or record',55],['title','Source title',76],['url','Source URL',95,'url'],['date','Publication date',18,'date'],['checked','Checked',16,'date']]},
 {name:'Export details',title:'Export scope and interpretation',columns:[['item','Item',38],['detail','Detail',125]]}
];
const wb=Workbook.create();
for(const spec of specs){
 const sh=wb.worksheets.add(spec.name);sh.showGridLines=false;
 const n=spec.columns.length;const range=sh.getRangeByIndexes(0,0,6,n);range.format.font={name:'Arial',size:11,color:'#243841'};range.format.verticalAlignment='top';
 sh.getRange('A2').values=[[spec.title]];sh.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:'#254F4D'};sh.getRange('A2').format.rowHeight=26;
 sh.getRange('A3').values=[['Kenya donor intelligence']];sh.getRange('A3').format.font={name:'Arial',size:11,italic:true,color:'#596F74'};sh.getRange('A3').format.rowHeight=22;
 const head=sh.getRangeByIndexes(4,0,1,n);head.values=[spec.columns.map(c=>c[1])];head.format={fill:'#254F4D',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:38};
 const body=sh.getRangeByIndexes(5,0,1,n);body.values=[spec.columns.map(c=>c[3]==='number'||c[3]==='integer'?123:c[3]==='date'?new Date('2026-09-17T00:00:00Z'):'Sample')];body.format.wrapText=true;body.format.rowHeight=34;
 spec.columns.forEach((c,i)=>{sh.getRangeByIndexes(0,i,6,1).format.columnWidth=c[2];const cell=sh.getCell(5,i);if(c[3]==='number')cell.setNumberFormat('#,##0.00;[Red](#,##0.00);0.00');else if(c[3]==='integer')cell.setNumberFormat('0');else if(c[3]==='date')cell.setNumberFormat('yyyy-mm-dd');if(c[3]==='url')cell.format.font={name:'Arial',size:11,color:'#225F88',underline:'single'};});
 sh.freezePanes.freezeRows(5);sh.freezePanes.freezeColumns(1);
}
wb.recalculate();
await (await SpreadsheetFile.exportXlsx(wb)).save(out+'/partner-template.xlsx');
await fs.writeFile(out+'/specs.json',JSON.stringify(specs,null,2));
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:2000})).ndjson);
