import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = process.argv[2];
const mode = process.argv[3] ?? 'build';
if (!sourceRoot || !['plan', 'build'].includes(mode)) {
  throw new Error(
    '用法: node content-pipeline/build-bank.mjs <上游仓库路径> [plan|build]',
  );
}
const sourceCommit = '278984401124db40da5163a31275b8deb9c282f4';
const actualCommit = execFileSync(
  'git',
  ['-C', sourceRoot, 'rev-parse', 'HEAD'],
  { encoding: 'utf8' },
).trim();
if (actualCommit !== sourceCommit)
  throw new Error(`来源提交不匹配: ${actualCommit}`);
const sourceDirectory = path.join(sourceRoot, '06-资料分析');
const outputDirectory = path.resolve('public/content/bank');
const reportDirectory = path.resolve('content-pipeline/output');
const selectedQuestionCount = mode === 'plan' ? 1100 : 1000;

function slug(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function decode(value) {
  return value
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function convertMarkup(value, assetPaths) {
  const converted = value
    .replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*\/?\s*>/g, (_, source) => {
      const asset = path.posix.normalize(`06-资料分析/${source}`);
      if (!asset.startsWith('90-图片/'))
        throw new Error(`非法图片路径: ${source}`);
      assetPaths.add(asset);
      const label = asset.includes('公式图/') ? '公式图片' : '题目图片';
      return `\n\n![${label}](/content/bank/assets/${asset.slice('90-图片/'.length)})\n\n`;
    })
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n');
  return decode(converted).trim();
}

function parsePaper(fileName, text) {
  const header = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1];
  if (!header) return [];
  const field = (key) =>
    new RegExp(`^${key}:\\s*"?([^"\\n]+)`, 'm').exec(header)?.[1]?.trim();
  const region = field('地区');
  const year = Number(field('年份'));
  const title = field('试卷');
  if (!region || !Number.isInteger(year) || !title) return [];
  const sections = [...text.matchAll(/^## 材料\s*\d+\s*$/gm)];
  const groups = [];
  for (let index = 0; index < sections.length; index++) {
    const start = sections[index].index + sections[index][0].length;
    const end = sections[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    const headings = [...block.matchAll(/^### 第\s*\d+\s*题[^\n]*$/gm)];
    if (!headings.length) continue;
    const assetPaths = new Set();
    const materialBody = convertMarkup(
      block.slice(0, headings[0].index),
      assetPaths,
    );
    if (!materialBody) continue;
    const materialId = `xc-material-${slug(`${fileName}:${index}`)}`;
    const source = {
      kind: 'third-party',
      title,
      url: `https://github.com/ERRRC/xingcezhenti/blob/${sourceCommit}/06-%E8%B5%84%E6%96%99%E5%88%86%E6%9E%90/${encodeURIComponent(fileName)}`,
      region,
      year,
      license: {
        status: 'unknown',
        description: '仅供私人学习；上游未明确授予题目与图片再分发许可。',
      },
    };
    const material = {
      id: materialId,
      version: 1,
      title: `${title} · 材料 ${index + 1}`,
      bodyMarkdown: materialBody,
      source,
      reviewStatus: 'source-provided',
    };
    const questions = [];
    for (let qIndex = 0; qIndex < headings.length; qIndex++) {
      const questionBlock = block.slice(
        headings[qIndex].index,
        headings[qIndex + 1]?.index ?? block.length,
      );
      const id = /\bqid\s+(\d+)/.exec(headings[qIndex][0])?.[1];
      const answer = /\*\*答案\*\*\s*[：:]\s*([A-D])\b/.exec(
        questionBlock,
      )?.[1];
      const explanationStart = questionBlock.indexOf('**官方解析**');
      const optionMatches = [
        ...questionBlock.matchAll(/^- \*\*([A-D])\*\*\.\s*(.*)$/gm),
      ];
      if (!id || !answer || explanationStart < 0 || optionMatches.length !== 4)
        continue;
      const stemStart = questionBlock.indexOf('\n') + 1;
      const stem = convertMarkup(
        questionBlock.slice(stemStart, optionMatches[0].index),
        assetPaths,
      );
      const options = optionMatches.map((match) => ({
        id: match[1],
        bodyMarkdown: convertMarkup(
          match[2].replace(/\s*✅\s*$/, ''),
          assetPaths,
        ),
      }));
      const marked = optionMatches.filter((match) => match[2].includes('✅'));
      const explanation = convertMarkup(
        questionBlock
          .slice(explanationStart + '**官方解析**'.length)
          .replace(/\n---\s*$/, ''),
        assetPaths,
      );
      if (
        !stem ||
        !explanation ||
        options.some((option) => !option.bodyMarkdown) ||
        options.map((option) => option.id).join('') !== 'ABCD' ||
        marked.length !== 1 ||
        marked[0][1] !== answer
      )
        continue;
      questions.push({
        id: `xc-${id}`,
        version: 1,
        type: 'single',
        stemMarkdown: stem,
        options,
        correctOptionIds: [answer],
        explanationMarkdown: explanation,
        knowledgePointIds: ['data-analysis-comprehensive'],
        materialRef: { id: materialId, version: 1 },
        difficulty: 'unrated',
        source,
        reviewStatus: 'source-provided',
      });
    }
    if (questions.length)
      groups.push({ material, questions, assets: [...assetPaths] });
  }
  return groups;
}

const files = (await readdir(sourceDirectory)).filter(
  (name) => name.endsWith('.md') && name !== 'README.md',
);
const parsed = [];
for (const file of files) {
  parsed.push(
    ...parsePaper(
      file,
      await readFile(path.join(sourceDirectory, file), 'utf8'),
    ),
  );
}
parsed.sort((a, b) => {
  const aHubei = a.material.source.region === '湖北' ? 0 : 1;
  const bHubei = b.material.source.region === '湖北' ? 0 : 1;
  return (
    aHubei - bHubei ||
    b.material.source.year - a.material.source.year ||
    a.material.source.title.localeCompare(b.material.source.title) ||
    a.material.id.localeCompare(b.material.id)
  );
});
const groups = [];
const seen = new Set();
let questionCount = 0;
for (const group of parsed) {
  if (group.questions.some((question) => seen.has(question.id))) continue;
  if (
    mode === 'build' &&
    group.assets.some((asset) => !existsSync(path.join(sourceRoot, asset)))
  )
    continue;
  groups.push(group);
  questionCount += group.questions.length;
  group.questions.forEach((question) => seen.add(question.id));
  if (questionCount >= selectedQuestionCount) break;
}
if (questionCount < selectedQuestionCount)
  throw new Error(`仅找到 ${questionCount} 道合格单选题`);
const assets = [...new Set(groups.flatMap((group) => group.assets))].sort();
await mkdir(reportDirectory, { recursive: true });
await writeFile(
  path.join(reportDirectory, 'asset-paths.txt'),
  assets.join('\n') + '\n',
);
if (mode === 'plan') {
  console.log(
    `已规划 ${questionCount} 题、${groups.length} 份材料、${assets.length} 张图片`,
  );
  process.exit(0);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
for (const asset of assets) {
  const target = path.join(
    outputDirectory,
    'assets',
    asset.slice('90-图片/'.length),
  );
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(sourceRoot, asset), target);
}
const chunks = [];
for (let index = 0; index < groups.length; index += 20) {
  const slice = groups.slice(index, index + 20);
  const name = `questions-${String(chunks.length + 1).padStart(3, '0')}.json`;
  const payload = {
    materials: slice.map((group) => group.material),
    questions: slice.flatMap((group) => group.questions),
  };
  await writeFile(
    path.join(outputDirectory, name),
    JSON.stringify(payload) + '\n',
  );
  chunks.push({ file: name, count: payload.questions.length });
}
const manifest = {
  schemaVersion: 1,
  visibility: 'private',
  source: 'ERRRC/xingcezhenti',
  sourceCommit,
  questionCount,
  materialCount: groups.length,
  assetCount: assets.length,
  chunks,
};
await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
await writeFile(
  path.join(reportDirectory, 'report.json'),
  JSON.stringify(
    {
      ...manifest,
      parsedGroups: parsed.length,
      parsedQuestions: parsed.reduce(
        (sum, group) => sum + group.questions.length,
        0,
      ),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `已生成 ${questionCount} 题、${groups.length} 份材料、${assets.length} 张图片`,
);
