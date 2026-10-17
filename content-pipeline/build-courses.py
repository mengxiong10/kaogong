#!/usr/bin/env python3
"""Compile the 46 authored lesson outlines and pinned source examples to JSON."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
outlines = json.loads((ROOT / 'src/content/course-outlines.json').read_text())
selection = json.loads((ROOT / 'src/content/example-selection.json').read_text())
catalog = json.loads((ROOT / 'src/content/catalog.json').read_text())
points = {p['id']: p for p in catalog['knowledgePoints'] if p['kind'] != 'category'}
missing = set(points) - set(outlines) - {'data-analysis-growth-rate'}
extra = set(outlines) - set(points)
if missing or extra or len(outlines) != 46:
    raise SystemExit(f'课程提纲与目录不一致: missing={missing}, extra={extra}')

questions = {}
materials = {}
for directory in (ROOT / 'public/content/all-bank').iterdir():
    if not directory.is_dir() or directory.name == 'assets': continue
    for file in directory.glob('questions-*.json'):
        payload = json.loads(file.read_text())
        questions.update((q['id'], q) for q in payload['questions'])
        materials.update((m['id'], m) for m in payload['materials'])

examples = []
example_materials = []
lessons = []
used = set()
for point_id, point in points.items():
    if point_id == 'data-analysis-growth-rate': continue
    module = point['moduleId']
    candidates = [q for q in questions.values() if point_id in q['knowledgePointIds']]
    if point_id in selection:
        candidates = [q for q in candidates if q['id'] == selection[point_id]]
    if not candidates and point_id in {'data-analysis-current-base','data-analysis-difference'}:
        candidates = [q for q in questions.values() if q['knowledgePointIds'][0] in
                      {'data-analysis-growth-rate','data-analysis-comprehensive'}]
    if not candidates and point_id == 'verbal-passage':
        candidates = [q for q in questions.values() if q['knowledgePointIds'][0] == 'verbal-main-idea' and len(q['stemMarkdown']) > 400]
    if not candidates: raise SystemExit(f'没有可用例题: {point_id}')
    candidates.sort(key=lambda q:(q['id'] in used,
          q['source']['region'] != '湖北',
          len(q['stemMarkdown']) + len(q['explanationMarkdown']),
          -q['source']['year'],q['id']))
    question = candidates[0]
    used.add(question['id'])
    intro, core, steps, pitfall, check = outlines[point_id]
    material = materials.get(question['materialRef']['id']) if question['materialRef'] else None
    original = question['source']
    body = [
        '## 识别题型', intro,
        '## 核心概念与规则', core,
        '## 解题方法', steps,
        '## 真题例题',
        f'以下例题来自 [{original["title"]}]({original["url"]})（{original["region"]}，{original["year"]}）。答案与解析沿用上游，未经独立核验。',
    ]
    if material:
        body.extend(['**题目材料**', material['bodyMarkdown']])
    body.append(question['stemMarkdown'])
    body.extend([f'- **{choice["id"]}** {choice["bodyMarkdown"]}' for choice in question['options']])
    body.extend([f'**上游答案：{question["correctOptionIds"][0]}**',
                 '**上游解析**',question['explanationMarkdown'],
                 '## 易错点', pitfall,
                 '## 知识检测', check,
                 '完成阅读后进入对应知识点的真题练习。'])
    lesson = {
        'id':f'lesson-{point_id}', 'version':1, 'knowledgePointId':point_id,
        'title':f'{point["title"]}：从真题理解考点',
        'bodyMarkdown':'\n\n'.join(body),
        'exampleQuestionRefs':[{'id':question['id'],'version':question['version']}],
        'source':{
            'kind':'ai-assisted',
            'title':'依据 ERRRC/xingcezhenti 原题与解析整理的课程',
            'url':'https://github.com/ERRRC/xingcezhenti/tree/278984401124db40da5163a31275b8deb9c282f4',
            'region':'湖北','year':None,
            'license':{'status':'unknown','description':'含上游真题与解析，授权未明；仅供私人学习。'},
        },
        'reviewStatus':'source-derived',
    }
    lessons.append(lesson)
    examples.append(question)
    if material: example_materials.append(material)

payload = {'lessons':lessons,
           'questions':list({q['id']:q for q in examples}.values()),
           'materials':list({m['id']:m for m in example_materials}.values())}
(ROOT / 'src/content/all-courses.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
print(f'生成 {len(lessons)} 节课程、{len(payload["questions"])} 道例题')
