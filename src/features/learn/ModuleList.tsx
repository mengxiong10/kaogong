import { ChevronRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/catalog-context';
import { moduleIcons } from './module-presentation';

export function ModuleList() {
  const { modules, knowledgePoints } = useCatalog();
  return (
    <ul className="module-list" aria-label="行测六大模块">
      {modules.map((module) => {
        const Icon =
          moduleIcons[module.id as keyof typeof moduleIcons] ?? BookOpen;
        const count = knowledgePoints.filter(
          (point) => point.moduleId === module.id && point.kind !== 'category',
        ).length;
        return (
          <li key={module.id}>
            <Link
              to={`/learn/${module.id}`}
              className="module-row flex min-h-[79px] items-center gap-3 border-b border-border hover:bg-muted"
            >
              <span className="grid h-[42px] w-9 shrink-0 place-items-center text-primary">
                <Icon size={22} strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium wrap-anywhere">
                  {module.title}
                </span>
                <span className="mt-[3px] block text-[10px] text-muted-foreground">
                  {count} 个知识点
                </span>
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
