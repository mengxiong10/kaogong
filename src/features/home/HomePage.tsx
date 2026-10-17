import { ArrowUpRight, BookOpen, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '../../components/ui/button';
import { useCatalog } from '../../app/catalog-context';
import { catalogRepository, practiceRepository } from '../../data';
import { ModuleList } from '../learn/ModuleList';

export function HomePage() {
  const { knowledgePoints } = useCatalog();
  const count = knowledgePoints.filter(
    (point) => point.kind !== 'category',
  ).length;
  const [history, setHistory] = useState<
    { answers: number; lessons: number } | 'loading' | 'error'
  >('loading');
  useEffect(() => {
    let active = true;
    Promise.all([
      practiceRepository.getAnswers(),
      catalogRepository.getLessonProgress(),
    ])
      .then(([answers, progress]) => {
        if (active)
          setHistory({
            answers: answers.length,
            lessons: progress.filter((entry) => entry.status !== 'not-started')
              .length,
          });
      })
      .catch(() => {
        if (active) setHistory('error');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="home-page px-[22px] pt-[30px] pb-[18px] [&>h1]:text-[26px] [&>h1]:leading-[1.45] [&>h1]:font-semibold [&>h1]:tracking-[-0.6px] [&>h1]:wrap-anywhere">
      <p className="mb-2.5 text-[10px] font-medium tracking-[1.4px] text-muted-foreground">
        湖北省考 / 行政职业能力测验
      </p>
      <h1>从一个知识点开始。</h1>
      <p className="mt-[9px] text-[13px] leading-[1.8] text-muted-foreground">
        先建立知识框架，再一步步练习与巩固。
      </p>
      <section
        className="mt-[26px] rounded-[10px] border border-border bg-accent p-5 [&>h2]:mt-[17px] [&>h2]:text-[19px] [&>h2]:font-semibold [&>p]:mt-2 [&>p]:mb-[18px] [&>p]:text-xs [&>p]:leading-[1.9] [&>p]:text-muted-foreground"
        aria-labelledby="welcome-title"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            你的学习空间
          </span>
          <Badge
            variant="outline"
            className="rounded border-border px-1.5 py-0.5 text-[10px] whitespace-nowrap text-primary"
          >
            目录已就绪
          </Badge>
        </div>
        <h2 id="welcome-title">看清全貌，找到起点</h2>
        <p>六大模块、{count} 个知识点。全部课程和对应真题练习已开放。</p>
        <Button className="min-h-11" asChild>
          <Link to="/learn">
            浏览知识体系
            <ArrowUpRight />
          </Link>
        </Button>
      </section>
      <section aria-labelledby="modules-title">
        <div className="mt-[29px] mb-[7px] flex items-center justify-between [&>h2]:text-[15px] [&>h2]:font-semibold">
          <h2 id="modules-title">学习地图</h2>
          <Link
            to="/learn"
            className="inline-flex min-h-11 items-center gap-[3px] text-[11px] text-muted-foreground"
          >
            全部模块
            <ChevronRight size={14} />
          </Link>
        </div>
        <ModuleList />
      </section>
      <section
        className="mt-[29px] flex items-start gap-3.5 text-muted-foreground [&_h2]:text-[13px] [&_h2]:font-medium [&_h2]:text-foreground [&_p]:mt-[5px] [&_p]:text-[11px] [&_p]:leading-[1.8] [&>svg]:mt-[3px] [&>svg]:shrink-0"
        aria-labelledby="learning-title"
      >
        <BookOpen size={24} strokeWidth={1.5} />
        <div>
          {history === 'loading' ? (
            <p role="status">正在读取学习记录…</p>
          ) : history === 'error' ? (
            <p role="alert">学习记录暂时无法读取，请刷新后重试。</p>
          ) : history.answers === 0 && history.lessons === 0 ? (
            <>
              <h2 id="learning-title">还没有学习记录</h2>
              <p>从任一知识点课程和真题练习开始，这里会记录你的学习足迹。</p>
            </>
          ) : (
            <>
              <h2 id="learning-title">学习记录已保存在本地</h2>
              <p>
                {history.answers} 条作答记录 · {history.lessons}{' '}
                节课程留下学习进度
              </p>
            </>
          )}
        </div>
      </section>
      <p className="mt-[34px] text-center text-[10px] text-muted-foreground">
        为专注学习而设计 · 当前浏览器本地保存
      </p>
    </div>
  );
}
