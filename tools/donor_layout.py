"""Keep the complete donor toolkit while separating everyday and advanced controls."""
import re

def refine(html, root):
    start=html.index('<div class="filterbar">')
    end=html.index('<div id="overview"', start)
    old=html[start:end]
    def control(key):
        matches=re.findall(r'<label>[^<]*<(?:input|select) id="'+key+r'".*?</label>',old,re.S)
        assert len(matches)==1,(key,len(matches))
        return matches[0]
    nav=re.search(r'<nav class="tabs".*?</nav>',old,re.S).group()
    guide='''<details id="programmeGuide" class="programme-guide" open>
<summary>Research the funding landscape for your programme</summary>
<ol><li><strong>Find relevant existing work</strong><p>Choose a sector and county, or search by keyword, project or organisation.</p></li>
<li><strong>Assess potential donors</strong><p>Compare funding history. Use <b>Partners &amp; routes</b> to examine priorities, eligibility and funding routes, then judge their fit for your programme.</p></li>
<li><strong>Build your funding case</strong><p>Review <b>Project evidence</b> for partners and possible duplication. Use <a href="#analysis" target="_parent">Country analysis</a> to support your assessment of need.</p></li></ol>
</details>'''
    primary='<div class="filterbar primary-filters" aria-label="Focus your search">'+''.join(control(k) for k in ['search','sector','county'])+'</div>'
    advanced='''<div class="filter-options"><details id="advancedFilters" class="advanced-filters"><summary>More filters <span class="filter-hint">Partner, years and finance</span><span id="advancedCount" class="filter-count" hidden></span></summary><div class="advanced-grid">'''+''.join(control(k) for k in ['donor','from','to','measure','instrument','coverage'])+'''</div></details><button id="reset" class="reset-filters">Reset filters</button></div>'''
    context='''<div class="reading-context"><p id="selectionSummary" class="selection-summary"></p><details class="reading-note"><summary>How to read the figures</summary><p class="scope-note" id="scope"></p><p>Use funding history to inform your donor research. Check current priorities, eligibility and application dates in the linked sources.</p></details></div>'''
    html=html[:start]+guide+nav+primary+advanced+context+'<div class="kpis" id="kpis"></div>\n'+html[end:]
    html=html.replace('<main class="page">','<main class="page donor-page">',1)
    html=html.replace('<p class="small" id="coverageText">','<p id="reviewCoverage" class="small"></p><p id="researchStatus" class="small"></p><p class="small" id="coverageText">',1)
    html=html.replace('Explore funding histories, find partners working in your sector, and examine the evidence behind their Kenya portfolios.','Search existing projects and funding to identify potential donors, partners and related work for your programme.',1)
    html=html.replace('</head>','<style>'+ (root/'assets/donor-clarity.css').read_text()+'</style></head>',1)
    return html
