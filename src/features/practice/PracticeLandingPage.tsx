import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/app/catalog-context';
import { contentRepository, practiceRepository } from '@/data';
import { dataAnalysisBankPointId } from '@/domain/content-ids';
import type { PracticeSession } from '@/domain/practice';
import {
  startDataAnalysisPractice,
  startModulePractice,
} from './start-practice';

export function PracticeLandingPage() {
  const navigate = useNavigate();
  const { modules, knowledgePoints } = useCatalog();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [bankCount, setBankCount] = useState(0);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    practiceRepository
      .getSessions()
      .then(setSessions)
      .catch(() => setError('练习记录暂时无法读取。'));
    contentRepository
      .getTrainingQuestions(dataAnalysisBankPointId)
      .then((questions) => setBankCount(questions.length))
      .catch(() => setError('私人题库暂时无法读取。'));
  }, []);

  async function start() {
    setStarting(true);
    try {
      navigate(`/practice/session/${await startDataAnalysisPractice()}`);
    } catch {
      setError('练习暂时无法创建，请稍后重试。');
      setStarting(false);
    }
  }

  async function startModule(moduleId: string) {
    setStarting(true);
    try {
      const ids = knowledgePoints
        .filter(
          (point) => point.moduleId === moduleId && point.kind !== 'category',
        )
        .map((point) => point.id);
      navigate(`/practice/session/${await startModulePractice(moduleId, ids)}`);
    } catch {
      setError('模块题库暂时无法导入或创建练习，请稍后重试。');
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
      <h1 className="text-[26px] font-semibold">练习行测真题</h1>
      <p className="mt-3 text-[13px] leading-[1.8] text-muted-foreground">
        交卷后统一看解析，刷新可继续作答。真题答案来自原题库，未经独立核验。
      </p>
      <div className="mt-7 rounded-lg border border-border p-5">
        <h2 className="text-base font-semibold">资料分析快捷练习</h2>
        <p className="mt-2 text-xs leading-[1.8] text-muted-foreground">
          私人题库已收录 {bankCount}
          道单选题，保留原图和共享材料；优先练习湖北卷，再逐步覆盖其他地区。
        </p>
        <Button
          className="mt-5 min-h-11 w-full"
          onClick={start}
          disabled={starting || bankCount === 0}
        >
          {starting ? '正在准备…' : '开始练习真题'}
          <ArrowRight />
        </Button>
      </div>
      <section className="mt-7">
        <h2 className="text-sm font-semibold">按模块练习</h2>
        <p className="mt-2 text-xs leading-[1.8] text-muted-foreground">
          首次进入模块时会导入该模块题目，进度保存在本机。
        </p>
        <div className="mt-3 divide-y divide-border border-y border-border">
          {modules.map((module) => (
            <div
              key={module.id}
              className="flex min-h-14 items-center justify-between gap-3"
            >
              <span className="text-sm">{module.title}</span>
              <Button
                variant="ghost"
                disabled={starting}
                onClick={() => startModule(module.id)}
              >
                练习{module.title}
                <ArrowRight size={15} />
              </Button>
            </div>
          ))}
        </div>
      </section>
      <Link
        to="/learn/data-analysis/data-analysis-growth-rate"
        className="mt-3 flex min-h-11 items-center justify-center text-xs text-primary"
      >
        阅读增长率课程
      </Link>
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
                    真题练习 · {item.questionRefs.length} 题 · 已到第{' '}
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
