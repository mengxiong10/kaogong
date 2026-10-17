import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public/content/bank');
const manifest = JSON.parse(
  await readFile(path.join(root, 'manifest.json'), 'utf8'),
);
if (
  manifest.visibility !== 'private' ||
  manifest.questionCount < 1000 ||
  manifest.schemaVersion !== 1
)
  throw new Error('私人题库清单不符合首批要求');
const ids = new Set();
const materials = new Set();
const refs = new Set();
let count = 0;
let imageCount = 0;
for (const chunk of manifest.chunks) {
  const batch = JSON.parse(await readFile(path.join(root, chunk.file), 'utf8'));
  if (batch.questions.length !== chunk.count)
    throw new Error(`分包题数不符: ${chunk.file}`);
  for (const material of batch.materials) {
    if (materials.has(material.id))
      throw new Error(`材料 ID 重复: ${material.id}`);
    materials.add(material.id);
    refs.add(material.id);
  }
  for (const question of batch.questions) {
    if (ids.has(question.id)) throw new Error(`题目 ID 重复: ${question.id}`);
    ids.add(question.id);
    if (
      question.type !== 'single' ||
      question.options.length !== 4 ||
      question.correctOptionIds.length !== 1 ||
      question.reviewStatus !== 'source-provided' ||
      question.source.license.status !== 'unknown'
    )
      throw new Error(`题目状态或选项异常: ${question.id}`);
    const marked = question.options.filter(
      (option) => option.id === question.correctOptionIds[0],
    );
    if (marked.length !== 1) throw new Error(`答案不在选项中: ${question.id}`);
    if (!question.materialRef) throw new Error(`缺少共享材料: ${question.id}`);
  }
  for (const body of [
    ...batch.materials.map((item) => item.bodyMarkdown),
    ...batch.questions.flatMap((item) => [
      item.stemMarkdown,
      item.explanationMarkdown,
      ...item.options.map((option) => option.bodyMarkdown),
    ]),
  ]) {
    for (const match of body.matchAll(
      /!\[[^\]]*\]\(\/content\/bank\/assets\/([^)]*)\)/g,
    )) {
      const file = path.join(root, 'assets', match[1]);
      await access(file);
      imageCount++;
    }
  }
  count += batch.questions.length;
}
if (
  count !== manifest.questionCount ||
  materials.size !== manifest.materialCount
)
  throw new Error('题目或材料总数不符');
for (const chunk of manifest.chunks) {
  const batch = JSON.parse(await readFile(path.join(root, chunk.file), 'utf8'));
  for (const question of batch.questions)
    if (!refs.has(question.materialRef.id))
      throw new Error(`材料引用不存在: ${question.id}`);
}
console.log(
  `题库校验通过：${count} 题、${materials.size} 份材料、${imageCount} 次图片引用`,
);
