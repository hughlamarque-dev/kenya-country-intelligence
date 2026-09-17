"""Package the artifact-tool workbook as a readable, on-demand browser template.
Usage: python tools/partner-export/pack-template.py TEMPLATE_DIRECTORY
"""
import json,sys,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
folder=Path(sys.argv[1]);root=Path(__file__).resolve().parents[2]
ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(folder/'partner-template.xlsx') as z:
    entries={n:z.read(n).decode('utf-8') for n in z.namelist()}
specs=json.loads((folder/'specs.json').read_text())
for i,spec in enumerate(specs,1):
    spec['path']=f'xl/worksheets/sheet{i}.xml'
    tree=ET.fromstring(entries[spec['path']]);cells={c.attrib['r']:c.attrib.get('s','0') for c in tree.findall('.//x:c',ns)}
    spec['styles']={'title':cells['A2'],'subtitle':cells['A3'],'header':cells['A5'],'body':[c.attrib.get('s','0') for c in tree.findall('.//x:row[@r="6"]/x:c',ns)]}
(root/'assets/partner-export-template.json').write_text(json.dumps({'version':1,'entries':entries,'sheets':specs},ensure_ascii=False,separators=(',',':'))+'\n')
print('Packaged styled workbook:',(root/'assets/partner-export-template.json').stat().st_size,'bytes')
