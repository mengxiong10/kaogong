import { ChevronRight, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatAccuracy,
  useAnalyticsReport,
} from '../analytics/use-analytics-report';
import { ModuleList } from '../learn/ModuleList';

export function HomePage() {
  const analytics = useAnalyticsReport();
  return (
    <div className="px-[22px] pt-[28px] pb-[18px]">
      <h1 className="text-[26px] font-semibold">今天学什么？</h1>
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
            {analytics.report.recent.sessions.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                完成一套真题后，这里会显示你的学习数据。
              </p>
            )}
          </>
        )}
      </section>
      <section aria-labelledby="modules-title">
        <div className="mt-[29px] mb-[7px] flex items-center justify-between [&>h2]:text-[15px] [&>h2]:font-semibold">
          <h2 id="modules-title">学习地图</h2>
          <Link
            to="/learn"
            className="inline-flex min-h-11 items-center gap-1 text-xs text-primary"
          >
            浏览知识体系 <ChevronRight size={14} />
          </Link>
        </div>
        <ModuleList />
      </section>
      <Link
        to="/backup"
        className="mt-7 flex min-h-11 items-center justify-between pt-3 text-xs text-primary"
      >
        <span className="inline-flex items-center gap-2">
          <Download size={15} /> 备份与恢复学习记录
        </span>
        <ChevronRight size={15} />
      </Link>
    </div>
  );
}
