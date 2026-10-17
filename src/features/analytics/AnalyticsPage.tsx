import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatAccuracy,
  formatMedian,
  useAnalyticsReport,
} from './use-analytics-report';

function ScoreLine({
  label,
  score,
}: {
  label: string;
  score: {
    answered: number;
    correct: number;
    accuracy: number | null;
    medianMs: number | null;
  };
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3 text-sm last:border-0">
      <span>{label}</span>
      <span className="text-right tabular-nums">
        <strong>{formatAccuracy(score.accuracy)}</strong>
        <span className="ml-2 text-xs text-muted-foreground">
          {score.correct}/{score.answered} 题 · 中位{' '}
          {formatMedian(score.medianMs)}
        </span>
      </span>
    </div>
  );
}

export function AnalyticsPage() {
  const state = useAnalyticsReport();
  if (state.status === 'loading')
    return (
      <p role="status" className="px-[22px] py-10 text-sm">
        正在读取学习报告…
      </p>
    );
  if (state.status === 'error')
    return (
      <div className="px-[22px] py-10">
        <p role="alert">学习报告暂时无法读取，请刷新后重试。</p>
        <Link className="mt-5 inline-block text-primary" to="/">
          返回首页
        </Link>
      </div>
    );

  const report = state.report;
  return (
    <div className="px-[22px] pt-6 pb-10">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={15} />
        返回首页
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">学习报告</h1>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        全部统计来自本机学习记录。上游真题答案未经独立核验，部分知识点为自动归类；数据仅供复习参考。
      </p>

      <section className="mt-7" aria-labelledby="overview-title">
        <h2 id="overview-title" className="text-base font-semibold">
          学习进度
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-border py-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">累计完成题数</p>
            <p className="mt-1 text-xl font-semibold">
              {report.totalAnsweredQuestions}
            </p>
            <p className="text-[11px] text-muted-foreground">
              去重题目，未作答不计
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">课程进度</p>
            <p className="mt-1 text-xl font-semibold">
              {report.lessons.completed}/{report.lessons.total}
            </p>
            <p className="text-[11px] text-muted-foreground">
              学习中 {report.lessons.learning} 节
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">待复习错题</p>
            <p className="mt-1 text-xl font-semibold">
              {report.pendingMistakes}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">已掌握错题</p>
            <p className="mt-1 text-xl font-semibold">
              {report.masteredMistakes}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="recent-title">
        <h2 id="recent-title" className="text-base font-semibold">
          最近 {report.recent.sessions.length} 套练习
        </h2>
        {report.recent.sessions.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(
              report.recent.sessions.at(-1)!.completedAt,
            ).toLocaleDateString('zh-CN')}
            —
            {new Date(
              report.recent.sessions[0]!.completedAt,
            ).toLocaleDateString('zh-CN')}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          未作答不计正确率；首次提交留空后再答，按重复作答计。
        </p>
        <div className="mt-2">
          <ScoreLine label="首次作答" score={report.recent.first} />
          <ScoreLine label="重复作答" score={report.recent.repeat} />
        </div>
        {report.recent.sessions.length === 0 && (
          <p className="py-5 text-sm text-muted-foreground">
            暂无已完成练习。完成练习后会出现近期记录。
          </p>
        )}
      </section>

      <section className="mt-7" aria-labelledby="modules-report-title">
        <h2 id="modules-report-title" className="text-base font-semibold">
          模块与知识点
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          按作答时的题目版本归类。主正确率仅统计首次作答；每行显示正确数/已答数，题量少时请结合原题判断。题目关联多个知识点时会分别计入。
        </p>
        <div className="mt-3 space-y-3">
          {report.modules.map((module) => (
            <details
              key={module.id}
              className="rounded-md border border-border px-3 py-2"
            >
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
                {module.title}
                <span className="float-right text-xs text-muted-foreground tabular-nums">
                  首次 {formatAccuracy(module.first.accuracy)} ·{' '}
                  {module.first.correct}/{module.first.answered}
                </span>
              </summary>
              <p className="mb-2 text-xs text-muted-foreground">
                首次中位用时 {formatMedian(module.first.medianMs)} · 重做{' '}
                {module.repeat.correct}/{module.repeat.answered} 题，正确率{' '}
                {formatAccuracy(module.repeat.accuracy)}
              </p>
              <div className="border-t border-border">
                {report.knowledgePoints
                  .filter((point) => point.moduleId === module.id)
                  .map((point) => (
                    <div
                      key={point.id}
                      className="border-b border-border py-3 text-xs last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          className="min-w-0 flex-1 text-primary"
                          to={`/learn/${module.id}/${point.id}`}
                        >
                          {point.title}
                        </Link>
                        <span className="shrink-0 tabular-nums">
                          首次 {formatAccuracy(point.first.accuracy)} ·{' '}
                          {point.first.correct}/{point.first.answered}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        首次中位 {formatMedian(point.first.medianMs)} · 重做{' '}
                        {point.repeat.correct}/{point.repeat.answered}{' '}
                        题，正确率 {formatAccuracy(point.repeat.accuracy)}
                      </p>
                    </div>
                  ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-7" aria-labelledby="history-title">
        <h2 id="history-title" className="text-base font-semibold">
          近期练习记录
        </h2>
        {report.recent.sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">暂无记录。</p>
        ) : (
          <div className="mt-2 border-t border-border">
            {report.recent.sessions.map((session) => (
              <Link
                key={session.id}
                to={`/practice/result/${session.id}`}
                className="flex min-h-16 items-center justify-between gap-3 border-b border-border py-3 text-sm"
              >
                <span>
                  <span className="block font-medium">
                    {new Date(session.completedAt).toLocaleDateString('zh-CN')}{' '}
                    ·{' '}
                    {session.moduleIds
                      .map(
                        (id) =>
                          report.modules.find((module) => module.id === id)
                            ?.title,
                      )
                      .filter(Boolean)
                      .join('、') || '练习'}{' '}
                    · {session.total} 题
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    首次 {session.first.correct}/{session.first.answered} · 重做{' '}
                    {session.repeat.correct}/{session.repeat.answered} · 未答{' '}
                    {session.unanswered}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
