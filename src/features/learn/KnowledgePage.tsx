import { useCatalog } from '../../app/catalog-context';
import { ModuleList } from './ModuleList';

export function KnowledgePage() {
  const { examProfiles } = useCatalog();
  const exam = examProfiles[0];
  return (
    <div className="px-[22px] pt-[30px] pb-[18px] [&>h1]:text-[26px] [&>h1]:leading-[1.45] [&>h1]:font-semibold [&>h1]:tracking-[-0.6px] [&>h1]:wrap-anywhere">
      <h1>知识体系</h1>
      <div className="mt-5">
        <ModuleList />
      </div>
      <aside className="mt-7 border-t border-dashed border-border pt-[19px] [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:text-[11px] [&>a]:text-primary [&>h2]:text-xs [&>h2]:font-medium [&>p]:mt-[7px] [&>p]:text-[11px] [&>p]:leading-[1.9] [&>p]:text-muted-foreground">
        <h2>关于这份目录</h2>
        <p>顶层模块依据湖北省考大纲，下级知识点为自建教学分类。</p>
        {exam?.outline.url && (
          <a href={exam.outline.url} target="_blank" rel="noreferrer">
            查看 {exam.year} 年考试大纲 ↗
          </a>
        )}
      </aside>
    </div>
  );
}
