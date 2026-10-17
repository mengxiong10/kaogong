import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public/content/all-bank');
const catalog = JSON.parse(await readFile('src/content/catalog.json', 'utf8'));
const courses = JSON.parse(
  await readFile('src/content/all-courses.json', 'utf8'),
);
const old = new Set();
for (const file of (await readdir('public/content/bank')).filter((name) =>
  /^questions-\d{3}\.json$/.test(name),
)) {
  const chunk = JSON.parse(
    await readFile(path.join('public/content/bank', file), 'utf8'),
  );
  chunk.questions.forEach((question) => old.add(question.id));
}
const ids = new Set(old);
const points = new Map(
  catalog.knowledgePoints
    .filter((point) => point.kind !== 'category')
    .map((point) => [point.id, point]),
);
const materials = new Set();
const assets = new Set();
let count = 0;
for (const module of catalog.modules) {
  const dir = path.join(root, module.id);
  const manifest = JSON.parse(
    await readFile(path.join(dir, 'manifest.json'), 'utf8'),
  );
  if (
    manifest.moduleId !== module.id ||
    manifest.visibility !== 'private' ||
    manifest.sourceCommit !== '278984401124db40da5163a31275b8deb9c282f4'
  )
    throw new Error(`模块题库清单异常: ${module.id}`);
  const moduleMaterials = new Set();
  const moduleRefs = new Set();
  let moduleCount = 0;
  for (const chunk of manifest.chunks) {
    const batch = JSON.parse(
      await readFile(path.join(dir, chunk.file), 'utf8'),
    );
    if (batch.questions.length !== chunk.count)
      throw new Error(`分包题数不符: ${chunk.file}`);
    for (const material of batch.materials) {
      moduleMaterials.add(material.id);
      materials.add(material.id);
    }
    for (const question of batch.questions) {
      if (ids.has(question.id)) throw new Error(`题目 ID 重复: ${question.id}`);
      ids.add(question.id);
      if (
        question.type !== 'single' ||
        question.options.length !== 4 ||
        question.correctOptionIds.length !== 1 ||
        !question.options.some(
          (option) => option.id === question.correctOptionIds[0],
        ) ||
        question.reviewStatus !== 'source-provided' ||
        question.source.license.status !== 'unknown' ||
        question.knowledgePointIds.some(
          (id) => points.get(id)?.moduleId !== module.id,
        )
      )
        throw new Error(`题目结构或归属异常: ${question.id}`);
      if (question.materialRef) moduleRefs.add(question.materialRef.id);
      for (const body of [
        question.stemMarkdown,
        question.explanationMarkdown,
        ...question.options.map((option) => option.bodyMarkdown),
      ])
        for (const match of body.matchAll(
          /!\[[^\]]*\]\(\/content\/all-bank\/assets\/([^)]*)\)/g,
        ))
          assets.add(match[1]);
    }
    for (const material of batch.materials)
      for (const match of material.bodyMarkdown.matchAll(
        /!\[[^\]]*\]\(\/content\/all-bank\/assets\/([^)]*)\)/g,
      ))
        assets.add(match[1]);
    moduleCount += batch.questions.length;
  }
  if (
    moduleCount !== manifest.questionCount ||
    moduleMaterials.size !== manifest.materialCount
  )
    throw new Error(`模块题库计数不一致: ${module.id}`);
  for (const ref of moduleRefs)
    if (!moduleMaterials.has(ref))
      throw new Error(`共享材料引用不存在: ${ref}`);
  count += moduleCount;
}
for (const asset of assets)
  if (!existsSync(path.join(root, 'assets', asset)))
    throw new Error(`缺少图片: ${asset}`);
if (
  courses.lessons.length !== 46 ||
  new Set(courses.lessons.map((lesson) => lesson.knowledgePointId)).size !== 46
)
  throw new Error('课程未覆盖剩余 46 个知识点');
for (const lesson of courses.lessons) {
  if (
    !points.has(lesson.knowledgePointId) ||
    lesson.reviewStatus !== 'source-derived' ||
    lesson.source.license.status !== 'unknown' ||
    lesson.exampleQuestionRefs.some((ref) => !ids.has(ref.id))
  )
    throw new Error(`课程状态或例题引用异常: ${lesson.id}`);
}
console.log(
  `六模块校验通过：新增 ${count} 题、${materials.size} 份材料、${assets.size} 张图片、46 节课程`,
);
