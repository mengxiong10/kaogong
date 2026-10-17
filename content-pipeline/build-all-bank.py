#!/usr/bin/env python3
"""Build private, reproducible single-choice packages from pinned xingcezhenti."""

import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
COMMIT = '278984401124db40da5163a31275b8deb9c282f4'
MODULES = {
    'politics': '01-政治理论',
    'general': '02-常识判断',
    'verbal': '03-言语理解与表达',
    'quantitative': '04-数量关系',
    'reasoning': '05-判断推理',
    'data-analysis': '06-资料分析',
}
OUTPUT = ROOT / 'public/content/all-bank'
REPORT = ROOT / 'content-pipeline/output/all-bank-report.json'
CATALOG = json.loads((ROOT / 'src/content/catalog.json').read_text())
POINTS = {p['id']: p for p in CATALOG['knowledgePoints'] if p['kind'] != 'category'}
EXAMPLES = json.loads((ROOT / 'src/content/example-selection.json').read_text())
EXAMPLE_POINTS = defaultdict(list)
for point_id, question_id in EXAMPLES.items(): EXAMPLE_POINTS[question_id].append(point_id)

if not SOURCE or not SOURCE.is_dir():
    raise SystemExit('用法: python3 content-pipeline/build-all-bank.py <固定提交的上游仓库路径>')
actual = subprocess.check_output(['git', '-C', str(SOURCE), 'rev-parse', 'HEAD'], text=True).strip()
if actual != COMMIT:
    raise SystemExit(f'来源提交不匹配: {actual}')

existing = set()
for chunk in (ROOT / 'public/content/bank').glob('questions-*.json'):
    existing.update(q['id'] for q in json.loads(chunk.read_text())['questions'])

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()[:16]

def markup(value, assets):
    def image(match):
        source = match.group(1)
        if not source.startswith('../90-图片/'):
            raise ValueError(f'非法图片路径: {source}')
        asset = source.removeprefix('../90-图片/')
        if not (SOURCE / '90-图片' / asset).is_file():
            raise ValueError(f'缺少图片: {asset}')
        assets.add(asset)
        label = '公式图片' if '公式图/' in asset else '题目图片'
        return f'\n\n![{label}](/content/all-bank/assets/{asset})\n\n'
    value = re.sub(r'<img\b[^>]*\bsrc="([^"]+)"[^>]*\/?>', image, value)
    value = re.sub(r'<br\s*/?>', '\n', value)
    value = re.sub(r'</p>', '\n\n', value)
    value = re.sub(r'<p[^>]*>|<[^>]*>', '', value)
    return re.sub(r'\n{3,}', '\n\n', html.unescape(value)).strip()

def field(header, key):
    match = re.search(rf'^{key}:\s*"?([^"\n]+)', header, re.M)
    return match.group(1).strip() if match else None

def point_for(module, label, stem, explanation):
    text = stem
    if module == 'politics':
        if re.search('会议|纲要|规划|政策|时事|文件|决定', text): return 'politics-meetings-policy'
        if re.search('实践|实际|基层|人民群众', text): return 'politics-theory-practice'
        if re.search('措施|贯彻|落实|推进', text): return 'politics-policy-application'
        return 'politics-basic-theory'
    if module == 'general':
        labels = {'法律常识':'general-law','科技常识':'general-science','经济常识':'general-economics','地理国情':'general-geography'}
        if label in labels: return labels[label]
        if re.search('历史|朝代|古代|战役|皇帝|年代|文物', text): return 'general-history'
        if re.search('国情|人口|民族|行政区|我国', text): return 'general-national-context'
        if re.search('政治|党|政府', text): return 'general-politics'
        return 'general-humanities'
    if module == 'verbal':
        if label == '逻辑填空': return 'verbal-cloze'
        if label == '语句表达':
            return 'verbal-sentence-order' if re.search('排序|顺序|重新排列', stem) else 'verbal-sentence-fill'
        if len(stem) > 900 and stem.count('\n') >= 3: return 'verbal-passage'
        if re.search('意在|意图|旨在|想要说明', stem): return 'verbal-intention'
        if re.search('细节|符合文意|不符合文意|正确的是|错误的是', stem): return 'verbal-details'
        return 'verbal-main-idea'
    if module == 'quantitative':
        checks = [
            ('quantitative-work','工程|工作|效率|牛吃草'),
            ('quantitative-travel','行程|速度|路程|相遇|追及'),
            ('quantitative-profit','利润|成本|售价|折扣|定价'),
            ('quantitative-permutations','排列|组合|抽取|分配|选法|方案数|多少种|不同坐法'),
            ('quantitative-probability','概率|可能性|随机'),
            ('quantitative-geometry','面积|体积|圆形|圆柱|圆锥|三角形|正方形|角度|周长'),
            ('quantitative-inclusion-exclusion','既.*又|都不|容斥|同时参加|两项都|三项都'),
            ('quantitative-sequences','数列|规律|第.*项|递推'),
        ]
        for point, pattern in checks:
            if re.search(pattern, text): return point
        return 'quantitative-arithmetic'
    if module == 'reasoning':
        labels = {'图形推理':'reasoning-figures','定义判断':'reasoning-definitions','类比推理':'reasoning-analogy'}
        if label in labels: return labels[label]
        if re.search('加强|支持|削弱|质疑', stem): return 'reasoning-strengthen-weaken'
        if re.search('前提|假设|结论', stem): return 'reasoning-premise-conclusion'
        if re.search('如果.{0,20}(那么|就)|只有.{0,20}才|除非|充分条件|必要条件', stem): return 'reasoning-translation'
        if re.search('排序|安排|分配|对应', stem): return 'reasoning-analytical'
        return 'reasoning-logic'
    if label == '增长':
        if re.search('增长量|增加了多少', stem): return 'data-analysis-growth-amount'
        if re.search('基期|上年|去年', stem) and re.search('现期|今年|本年', stem): return 'data-analysis-current-base'
        return 'data-analysis-growth-rate'
    if label == '比重': return 'data-analysis-proportion'
    if label == '平均数': return 'data-analysis-average'
    if label == '倍数': return 'data-analysis-multiple'
    if re.search('截位|直除', explanation): return 'data-analysis-truncated-division'
    if re.search('差分法', explanation): return 'data-analysis-difference'
    if re.search('估算|近似|约为', explanation): return 'data-analysis-estimation'
    if re.search('同比|环比|百分点|占比|平均', stem): return 'data-analysis-terms'
    return 'data-analysis-comprehensive'

def parse_question(module, heading, block, source, material_ref, material_assets):
    qid = re.search(r'\bqid\s+(\d+)', heading)
    label = re.search(r'\bqid\s+\d+\s*·\s*([^<\n]+)', heading)
    answer = re.search(r'\*\*答案\*\*\s*[：:]\s*([A-D])\b', block)
    explanation_start = block.find('**官方解析**')
    options = list(re.finditer(r'^- \*\*([A-D])\*\*\.\s*(.*)$', block, re.M))
    if not qid or not answer or explanation_start < 0 or len(options) != 4:
        return None, 'structure'
    if ''.join(match.group(1) for match in options) != 'ABCD':
        return None, 'options'
    marked = [match for match in options if '✅' in match.group(2)]
    if len(marked) != 1 or marked[0].group(1) != answer.group(1):
        return None, 'answer-marker'
    assets = set(material_assets)
    try:
        stem = markup(block[:options[0].start()], assets)
        choices = [{'id': match.group(1), 'bodyMarkdown': markup(match.group(2).replace('✅',''), assets)} for match in options]
        explanation = markup(re.sub(r'\n---\s*$', '', block[explanation_start+len('**官方解析**'):]), assets)
    except ValueError:
        return None, 'missing-image'
    if not stem or not explanation or any(not choice['bodyMarkdown'] for choice in choices):
        return None, 'empty'
    question = {
        'id': f'xc-{qid.group(1)}', 'version': 1, 'type': 'single',
        'stemMarkdown': stem, 'options': choices, 'correctOptionIds': [answer.group(1)],
        'explanationMarkdown': explanation,
        'knowledgePointIds': [point_for(module, label.group(1).strip() if label else '', stem, explanation)],
        'materialRef': material_ref, 'difficulty': 'unrated',
        'source': source, 'reviewStatus': 'source-provided',
    }
    return (question, assets), None

all_questions = defaultdict(list)
all_materials = defaultdict(list)
all_assets = set()
skipped = defaultdict(Counter)
seen = set(existing)
for module, directory in MODULES.items():
    for paper in sorted((SOURCE / directory).glob('*.md')):
        if paper.name == 'README.md': continue
        text = paper.read_text()
        header = re.match(r'^---\n([\s\S]*?)\n---\n', text)
        if not header: continue
        region, year, title = field(header.group(1),'地区'), field(header.group(1),'年份'), field(header.group(1),'试卷')
        if not region or not year or not title or not year.isdigit(): continue
        source = {'kind':'third-party', 'title':title,
                  'url':f'https://github.com/ERRRC/xingcezhenti/blob/{COMMIT}/{quote(directory)}/{quote(paper.name)}',
                  'region':region, 'year':int(year),
                  'license':{'status':'unknown','description':'仅供私人学习；上游未明确授予题目与图片再分发许可。'}}
        headings = list(re.finditer(r'^#{2,3} 第\s*\d+\s*题[^\n]*$', text, re.M))
        material_sections = list(re.finditer(r'^## 材料\s*\d+\s*$', text, re.M)) if module == 'data-analysis' else []
        for index, heading in enumerate(headings):
            start = heading.end()+1
            end = headings[index+1].start() if index+1 < len(headings) else len(text)
            if material_sections:
                section = max((s for s in material_sections if s.start() < heading.start()), key=lambda s:s.start(), default=None)
                if not section: continue
                next_section = next((s for s in material_sections if s.start() > section.start()), None)
                if next_section: end = min(end, next_section.start())
                first_heading = next((h for h in headings if h.start() > section.start()), None)
                material_text = text[section.end():first_heading.start()] if first_heading else ''
                material_assets = set()
                try: material_body = markup(material_text, material_assets)
                except ValueError:
                    skipped[module]['missing-material-image'] += 1
                    continue
                if not material_body:
                    skipped[module]['empty-material'] += 1
                    continue
                material_id = f'xc-material-{digest(f"{paper.name}:{section.start()}")}'
                material_ref = {'id':material_id,'version':1}
            else:
                material_assets, material_ref = set(), None
            parsed, reason = parse_question(module, heading.group(), text[start:end], source, material_ref, material_assets)
            if module == 'data-analysis' and not material_ref:
                skipped[module]['no-material'] += 1
                continue
            if not parsed:
                skipped[module][reason] += 1
                continue
            question, assets = parsed
            question['knowledgePointIds'].extend(point_id for point_id in EXAMPLE_POINTS.get(question['id'], []) if point_id not in question['knowledgePointIds'])
            if question['id'] in seen:
                skipped[module]['duplicate-or-existing'] += 1
                continue
            seen.add(question['id'])
            all_questions[module].append(question)
            all_assets.update(assets)
            if material_ref and not any(m['id'] == material_id for m in all_materials[module]):
                all_materials[module].append({'id':material_id,'version':1,
                    'title':f'{title} · {section.group().removeprefix("## ")}', 'bodyMarkdown':material_body,
                    'source':source,'reviewStatus':'source-provided'})

OUTPUT.mkdir(parents=True, exist_ok=True)
for module in MODULES:
    directory = OUTPUT / module
    directory.mkdir(parents=True, exist_ok=True)
    for stale in directory.glob('questions-*.json'): stale.unlink()
    questions = sorted(all_questions[module], key=lambda q:(q['source']['region']!='湖北',-q['source']['year'],q['id']))
    materials = {m['id']:m for m in all_materials[module]}
    chunks = []
    for index in range(0, len(questions), 100):
        slice_ = questions[index:index+100]
        refs = {q['materialRef']['id'] for q in slice_ if q['materialRef']}
        payload = {'questions':slice_, 'materials':[materials[key] for key in sorted(refs)]}
        name = f'questions-{index//100+1:03d}.json'
        (directory / name).write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':'))+'\n')
        chunks.append({'file':name,'count':len(slice_)})
    manifest = {'schemaVersion':1,'visibility':'private','source':'ERRRC/xingcezhenti',
                'sourceCommit':COMMIT,'moduleId':module,'questionCount':len(questions),
                'materialCount':len(materials),'chunks':chunks}
    (directory / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

for asset in sorted(all_assets):
    target = OUTPUT / 'assets' / asset
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists(): shutil.copy2(SOURCE / '90-图片' / asset, target)

report = {'sourceCommit':COMMIT,'questionCount':sum(map(len,all_questions.values())),
          'materialCount':sum(map(len,all_materials.values())),'assetCount':len(all_assets),
          'modules':{module:{'questions':len(all_questions[module]),'materials':len(all_materials[module]),
                              'byPoint':dict(Counter(q['knowledgePointIds'][0] for q in all_questions[module])),
                              'skipped':dict(skipped[module])} for module in MODULES}}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('questionCount','materialCount','assetCount')},ensure_ascii=False))
