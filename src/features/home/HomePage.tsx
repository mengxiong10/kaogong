import { ArrowUpRight, ChevronRight, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '../../components/ui/button';
import { useCatalog } from '../../app/catalog-context';
import {
  formatAccuracy,
  useAnalyticsReport,
} from '../analytics/use-analytics-report';
import { ModuleList } from '../learn/ModuleList';

export function HomePage() {
  const { knowledgePoints } = useCatalog();
  const count = knowledgePoints.filter(
    (point) => point.kind !== 'category',
  ).length;
  const analytics = useAnalyticsReport();
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
      <section className="mt-7" aria-labelledby="learning-title">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="learning-title" className="text-[15px] font-semibold">
            学习概况
          </h2>
          <Link
            to="/analytics"
            className="inline-flex min-h-11 items-center gap-1 text-xs text-primary"
          >
            详细报告 <ChevronRight size={14} />
          </Link>
        </div>
        {analytics.status === 'loading' && (
          <p role="status" className="py-4 text-sm">
            正在读取学习记录…
          </p>
        )}
        {analytics.status === 'error' && (
          <p role="alert" className="py-4 text-sm">
            学习记录暂时无法读取，请刷新后重试。
          </p>
        )}
        {analytics.status === 'ready' && (
          <>
            <div className="grid grid-cols-3 gap-2 border-y border-border py-4">
              <div>
                <p className="text-[10px] text-muted-foreground">
                  近期首次正确率
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {formatAccuracy(analytics.report.recent.first.accuracy)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">待复习错题</p>
                <p className="mt-2 text-xl font-semibold">
                  {analytics.report.pendingMistakes}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">已完成课程</p>
                <p className="mt-2 text-xl font-semibold">
                  {analytics.report.lessons.completed}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{analytics.report.lessons.total}
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              近期按最近 {analytics.report.recent.sessions.length}{' '}
              套已完成练习计算；未作答不计正确率，重做单独统计。
            </p>
            {analytics.report.recent.sessions.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                完成一套真题后，这里会显示你的学习数据。
              </p>
            )}
            <Link
              to="/mistakes"
              className="mt-3 flex min-h-11 items-center justify-between text-xs text-primary"
            >
              查看待复习错题 <ChevronRight size={15} />
            </Link>
          </>
        )}
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
      <Link
        to="/backup"
        className="mt-7 flex min-h-11 items-center justify-between border-t border-border pt-3 text-xs text-primary"
      >
        <span className="inline-flex items-center gap-2">
          <Download size={15} /> 备份与恢复学习记录
        </span>
        <ChevronRight size={15} />
      </Link>
      <p className="mt-[34px] text-center text-[10px] text-muted-foreground">
        为专注学习而设计 · 当前浏览器本地保存
      </p>
    </div>
  );
}
