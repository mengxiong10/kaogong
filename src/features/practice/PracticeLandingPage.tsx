import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { practiceRepository } from '@/data';
import type { PracticeSession } from '@/domain/practice';
import { startGrowthRatePractice } from './start-practice';

export function PracticeLandingPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    practiceRepository
      .getSessions()
      .then(setSessions)
      .catch(() => setError('练习记录暂时无法读取。'));
  }, []);

  async function start() {
    setStarting(true);
    try {
      navigate(`/practice/session/${await startGrowthRatePractice()}`);
    } catch {
      setError('练习暂时无法创建，请稍后重试。');
      setStarting(false);
    }
  }

  const active = sessions.filter((item) => item.status === 'active');
  const finished = sessions.filter((item) => item.status === 'completed');
  return (
    <div className="px-[22px] pt-[30px] pb-8">
      <p className="mb-2 text-[10px] tracking-[1.2px] text-muted-foreground">
        专项练习
      </p>
      <h1 className="text-[26px] font-semibold">从增长率开始练。</h1>
      <p className="mt-3 text-[13px] leading-[1.8] text-muted-foreground">
        5 道原创单选题。交卷后统一看解析，刷新可继续作答。
      </p>
      <div className="mt-7 rounded-lg border border-border bg-accent p-5">
        <h2 className="text-base font-semibold">资料分析 · 增长率</h2>
        <p className="mt-2 text-xs leading-[1.8] text-muted-foreground">
          先识别题型，再确定基期与现期；留意负增长、连续增长和百分点。
        </p>
        <Button
          className="mt-5 min-h-11 w-full"
          onClick={start}
          disabled={starting}
        >
          {starting ? '正在准备…' : '开始一套新练习'}
          <ArrowRight />
        </Button>
        <Link
          to="/learn/data-analysis/data-analysis-growth-rate"
          className="mt-3 flex min-h-11 items-center justify-center text-xs text-primary"
        >
          先阅读增长率课程
        </Link>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
      {active.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">继续未完成练习</h2>
          <ul className="mt-2 divide-y divide-border">
            {active.map((item) => (
              <li key={item.id}>
                <Link
                  className="flex min-h-14 items-center justify-between text-xs"
                  to={`/practice/session/${item.id}`}
                >
                  <span>
                    增长率 · {item.questionRefs.length} 题 · 已到第{' '}
                    {item.currentIndex + 1} 题
                  </span>
                  <ArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {finished.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">最近交卷</h2>
          <ul className="mt-2 divide-y divide-border">
            {finished.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link
                  className="flex min-h-14 items-center justify-between text-xs"
                  to={`/practice/result/${item.id}`}
                >
                  <span className="flex items-center gap-2">
                    <Clock3 size={15} />
                    {new Date(item.completedAt!).toLocaleString('zh-CN')}
                  </span>
                  <ArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
