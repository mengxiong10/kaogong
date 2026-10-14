import type { KnowledgePoint } from '../domain/catalog';
import { CatalogSchema } from '../domain/validate-catalog';

export const outlineUrl =
  'https://gdkfq.ezhou.gov.cn/gk/bmptlj/bm/qzsj/fdzdgk/zkly/202604/t20260417_761135.html';
const definitions = [
  {
    id: 'politics',
    title: '政治理论',
    description: '理解理论，读懂政策，联系实际。',
    category: '理论与政策',
    points: [
      ['basic-theory', '基本政治理论'],
      ['meetings-policy', '重要会议与政策'],
      ['theory-practice', '理论联系实际'],
      ['policy-application', '政策理解与应用'],
    ],
  },
  {
    id: 'general',
    title: '常识判断',
    description: '建立法律、人文与科技的知识框架。',
    category: '综合常识',
    points: [
      ['law', '法律'],
      ['politics', '政治'],
      ['economics', '经济'],
      ['history', '历史'],
      ['humanities', '人文'],
      ['science', '科技'],
      ['geography', '地理'],
      ['national-context', '国情'],
    ],
  },
  {
    id: 'verbal',
    title: '言语理解与表达',
    description: '抓住文段重点，准确理解与表达。',
    category: '阅读与表达',
    points: [
      ['cloze', '逻辑填空'],
      ['main-idea', '主旨概括'],
      ['intention', '意图判断'],
      ['details', '细节理解'],
      ['sentence-order', '语句排序'],
      ['sentence-fill', '语句填空'],
      ['passage', '篇章阅读'],
    ],
  },
  {
    id: 'quantitative',
    title: '数量关系',
    description: '把文字条件转化为可求解的数量关系。',
    category: '数学运算',
    points: [
      ['arithmetic', '基础运算'],
      ['work', '工程问题'],
      ['travel', '行程问题'],
      ['profit', '经济利润'],
      ['permutations', '排列组合'],
      ['probability', '概率'],
      ['geometry', '几何'],
      ['inclusion-exclusion', '容斥原理'],
      ['sequences', '数列与规律'],
    ],
  },
  {
    id: 'reasoning',
    title: '判断推理',
    description: '识别规律，分析关系，建立逻辑链。',
    category: '推理基础',
    points: [
      ['figures', '图形推理'],
      ['definitions', '定义判断'],
      ['analogy', '类比推理'],
      ['logic', '逻辑判断'],
      ['strengthen-weaken', '加强与削弱'],
      ['premise-conclusion', '前提与结论'],
      ['translation', '翻译推理'],
      ['analytical', '分析推理'],
    ],
  },
  {
    id: 'data-analysis',
    title: '资料分析',
    description: '读懂统计材料，掌握公式与速算方法。',
    category: '统计与计算',
    points: [
      ['terms', '基础统计术语'],
      ['current-base', '现期量与基期量'],
      ['growth-rate', '增长率'],
      ['growth-amount', '增长量'],
      ['proportion', '比重'],
      ['average', '平均数'],
      ['multiple', '倍数'],
      ['truncated-division', '截位直除'],
      ['estimation', '估算'],
      ['difference', '差分法'],
      ['comprehensive', '综合资料分析'],
    ],
  },
] as const;

const knowledgePoints: KnowledgePoint[] = definitions.flatMap((module) => [
  {
    id: `${module.id}-foundation`,
    moduleId: module.id,
    parentId: null,
    title: module.category,
    order: 0,
    kind: 'category' as const,
    classification: 'teaching' as const,
  },
  ...module.points.map(([id, title], order) => ({
    id: `${module.id}-${id}`,
    moduleId: module.id,
    parentId: `${module.id}-foundation`,
    title,
    order,
    kind: (['truncated-division', 'estimation', 'difference'].includes(id)
      ? 'method'
      : 'knowledge') as KnowledgePoint['kind'],
    classification: 'teaching' as const,
  })),
]);

export const seedCatalog = CatalogSchema.parse({
  examProfiles: [
    {
      id: 'hubei-xingce-2026',
      title: '湖北省考 · 行政职业能力测验',
      region: '湖北',
      year: 2026,
      checkedAt: '2026-10-14',
      outline: {
        kind: 'official',
        title:
          '湖北省2026年度省市县乡考试录用公务员公共科目笔试考试大纲（政府网站转载）',
        url: outlineUrl,
        region: '湖北',
        year: 2026,
        license: {
          status: 'unknown',
          description:
            '仅引用模块分类与来源链接；未复制官方例题，未推定题库使用授权。',
        },
      },
    },
  ],
  modules: definitions.map((module, order) => ({
    id: module.id,
    examProfileId: 'hubei-xingce-2026',
    title: module.title,
    description: module.description,
    order,
    classification: 'official',
  })),
  knowledgePoints,
});
