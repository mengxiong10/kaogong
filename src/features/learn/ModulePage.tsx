import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useCatalog } from '../../app/catalog-context';
import type { KnowledgePoint } from '../../domain/catalog';
import { NotFoundPage } from './NotFoundPage';

function KnowledgeTree({
  points,
  parentId,
  moduleId,
}: {
  points: KnowledgePoint[];
  parentId: string | null;
  moduleId: string;
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
            <h2 className="mt-[22px] mb-3 text-sm font-semibold">
              {point.title}
            </h2>
          ) : (
            <Link
              className="knowledge-row flex min-h-[58px] items-center justify-between gap-3 border-b border-border text-[13px] text-foreground"
              to={`/learn/${moduleId}/${point.id}`}
            >
              <span className="min-w-0 wrap-anywhere">{point.title}</span>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          )}
          <KnowledgeTree
            points={points}
            parentId={point.id}
            moduleId={moduleId}
          />
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
  return (
    <div className="px-[22px] pt-[30px] pb-[18px] [&>h1]:text-[26px] [&>h1]:leading-[1.45] [&>h1]:font-semibold [&>h1]:tracking-[-0.6px] [&>h1]:wrap-anywhere">
      <Link
        to="/learn"
        className="-mt-3 mb-4 inline-flex min-h-11 items-center gap-[7px] text-xs text-muted-foreground"
      >
        <ArrowLeft size={17} />
        知识体系
      </Link>
      <h1>{module.title}</h1>
      <p className="mt-[9px] text-[13px] leading-[1.8] text-muted-foreground">
        {module.description}
      </p>
      <div className="mt-5">
        <KnowledgeTree points={points} parentId={null} moduleId={module.id} />
      </div>
    </div>
  );
}
