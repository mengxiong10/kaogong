import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Circle } from 'lucide-react';
import { useCatalog } from '../../app/catalog-context';
import type { KnowledgePoint } from '../../domain/catalog';
import { NotFoundPage } from './NotFoundPage';

function KnowledgeTree({
  points,
  parentId,
}: {
  points: KnowledgePoint[];
  parentId: string | null;
}) {
  const children = points
    .filter((point) => point.parentId === parentId)
    .sort((a, b) => a.order - b.order);
  if (children.length === 0) return null;
  return (
    <ul
      className={
        parentId === null
          ? 'knowledge-tree'
          : 'ml-[5px] border-l border-border pl-3.5'
      }
    >
      {children.map((point) => (
        <li key={point.id}>
          {point.kind === 'category' ? (
            <h2 className="mt-[22px] mb-3 flex flex-wrap items-center gap-2.5 text-sm font-semibold [&>span]:text-[9px] [&>span]:font-normal [&>span]:text-muted-foreground">
              {point.title}
              <span>自建教学分类</span>
            </h2>
          ) : (
            <div className="knowledge-row flex min-h-[58px] items-center gap-2.5 border-b border-border text-[13px] [&>span:first-of-type]:min-w-0 [&>span:first-of-type]:flex-1 [&>span:first-of-type]:wrap-anywhere">
              <Circle size={13} className="shrink-0 text-muted-foreground" />
              <span>
                {point.id === 'data-analysis-growth-rate' ? (
                  <Link
                    className="inline-flex min-h-11 items-center text-primary"
                    to="/learn/data-analysis/data-analysis-growth-rate"
                  >
                    {point.title}
                  </Link>
                ) : (
                  point.title
                )}
              </span>
              <span className="text-[9px] whitespace-nowrap text-muted-foreground">
                {point.id === 'data-analysis-growth-rate'
                  ? '开始学习'
                  : '课程待补充'}
              </span>
            </div>
          )}
          <KnowledgeTree points={points} parentId={point.id} />
        </li>
      ))}
    </ul>
  );
}

export function ModulePage() {
  const { moduleId } = useParams();
  const { modules, knowledgePoints } = useCatalog();
  const module = modules.find((entry) => entry.id === moduleId);
  if (!module) return <NotFoundPage />;
  const points = knowledgePoints.filter(
    (point) => point.moduleId === module.id,
  );
  const count = points.filter((point) => point.kind !== 'category').length;
  return (
    <div className="px-[22px] pt-[30px] pb-[18px] [&>h1]:text-[26px] [&>h1]:leading-[1.45] [&>h1]:font-semibold [&>h1]:tracking-[-0.6px] [&>h1]:wrap-anywhere">
      <Link
        to="/learn"
        className="-mt-3 mb-4 inline-flex min-h-11 items-center gap-[7px] text-xs text-muted-foreground"
      >
        <ArrowLeft size={17} />
        知识体系
      </Link>
      <p className="mb-2.5 text-[10px] font-medium tracking-[1.4px] text-muted-foreground">
        官方考查模块
      </p>
      <h1>{module.title}</h1>
      <p className="mt-[9px] text-[13px] leading-[1.8] text-muted-foreground">
        {module.description}
      </p>
      <div className="mt-[25px] mb-6 flex items-center justify-between border-y border-border py-3 text-[11px] text-muted-foreground [&_strong]:mr-[3px] [&_strong]:text-xl [&_strong]:font-medium [&_strong]:text-primary">
        <span>
          <strong>{count}</strong> 个知识点
        </span>
        <span>教学目录</span>
      </div>
      <KnowledgeTree points={points} parentId={null} />
      <aside className="mt-[25px] flex items-start gap-[11px] rounded-md bg-muted p-4 [&>p]:text-[11px] [&>p]:leading-[1.9] [&>p]:text-muted-foreground [&>svg]:mt-0.5 [&>svg]:shrink-0 [&>svg]:text-primary">
        <BookOpen size={19} />
        <p>增长率课程与 5 题练习已经开放，其他知识点的课程将逐步补充。</p>
      </aside>
    </div>
  );
}
