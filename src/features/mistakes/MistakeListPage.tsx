import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCatalog } from '@/app/catalog-context';
import { Button } from '@/components/ui/button';
import { practiceRepository } from '@/data';
import type { MistakeReviewItem } from '@/data/practice-repository';
import { startMistakePractice } from '@/features/practice/start-practice';

function previewStem(markdown: string) {
  return (
    markdown
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片]')
      .replace(/[`*_#>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || '图片题'
  );
}

export function MistakeListPage() {
  const navigate = useNavigate();
  const { modules, knowledgePoints } = useCatalog();
  const [items, setItems] = useState<MistakeReviewItem[]>([]);
  const [status, setStatus] = useState<'pending' | 'mastered'>('pending');
  const [moduleId, setModuleId] = useState('all');
  const [pointId, setPointId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    practiceRepository
      .getMistakeReviewItems()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch(() => {
        if (active) setError('错题记录暂时无法读取，请刷新重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pointById = useMemo(
    () => new Map(knowledgePoints.map((point) => [point.id, point])),
    [knowledgePoints],
  );
  const visible = items.filter(
    (item) =>
      item.state.status === status &&
      (moduleId === 'all' ||
        item.question.knowledgePointIds.some(
          (id) => pointById.get(id)?.moduleId === moduleId,
        )) &&
      (pointId === 'all' || item.question.knowledgePointIds.includes(pointId)),
  );
  const availablePoints = knowledgePoints.filter(
    (point) =>
      point.kind !== 'category' &&
      (moduleId === 'all' || point.moduleId === moduleId) &&
      items.some(
        (item) =>
          item.state.status === status &&
          item.question.knowledgePointIds.includes(point.id),
      ),
  );
  const pendingCount = items.filter(
    (item) => item.state.status === 'pending',
  ).length;

  async function startReview(questionIds: string[]) {
    setStarting(true);
    setError('');
    try {
      navigate(`/practice/session/${await startMistakePractice(questionIds)}`);
    } catch {
      setError('所选错题中有题目暂时无法重做，请查看题目详情。');
      setStarting(false);
    }
  }

  return (
    <div className="px-[22px] pt-7 pb-10">
      <h1 className="text-[26px] font-semibold">错题本</h1>
      <p className="mt-2 text-xs leading-[1.8] text-muted-foreground">
        {pendingCount} 道待复习。答对一次不会自动移除，掌握状态由你决定。
      </p>
      <div className="mt-5 flex gap-2" aria-label="复习状态">
        <Button
          variant={status === 'pending' ? 'default' : 'outline'}
          aria-pressed={status === 'pending'}
          onClick={() => {
            setStatus('pending');
            setPointId('all');
          }}
        >
          待复习
        </Button>
        <Button
          variant={status === 'mastered' ? 'default' : 'outline'}
          aria-pressed={status === 'mastered'}
          onClick={() => {
            setStatus('mastered');
            setPointId('all');
          }}
        >
          已掌握
        </Button>
      </div>
      <section className="mt-6" aria-label="错题筛选">
        <h2 className="text-sm font-semibold">按模块筛选</h2>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {[{ id: 'all', title: '全部' }, ...modules].map((module) => (
            <Button
              key={module.id}
              variant={moduleId === module.id ? 'secondary' : 'ghost'}
              className="shrink-0"
              aria-pressed={moduleId === module.id}
              onClick={() => {
                setModuleId(module.id);
                setPointId('all');
              }}
            >
              {module.title}
            </Button>
          ))}
        </div>
        {availablePoints.length > 0 && (
          <>
            <h2 className="mt-3 text-sm font-semibold">按知识点筛选</h2>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {[{ id: 'all', title: '全部' }, ...availablePoints].map(
                (point) => (
                  <Button
                    key={point.id}
                    variant={pointId === point.id ? 'secondary' : 'ghost'}
                    className="shrink-0"
                    aria-pressed={pointId === point.id}
                    onClick={() => setPointId(point.id)}
                  >
                    {point.title}
                  </Button>
                ),
              )}
            </div>
          </>
        )}
      </section>
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-8 text-sm">
          正在读取错题…
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          当前筛选下没有{status === 'pending' ? '待复习' : '已掌握'}错题。
        </p>
      ) : (
        <>
          <div className="mt-5 flex justify-end">
            <Button
              disabled={starting}
              onClick={() =>
                startReview(
                  visible.slice(0, 5).map((item) => item.state.questionId),
                )
              }
            >
              {starting
                ? '正在准备…'
                : `重做前 ${Math.min(visible.length, 5)} 题`}
            </Button>
          </div>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {visible.map((item) => (
              <li key={item.state.questionId}>
                <Link
                  to={`/mistakes/${encodeURIComponent(item.state.questionId)}`}
                  className="flex min-h-20 items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">
                      {previewStem(item.question.stemMarkdown)}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      答错 {item.incorrectCount} 次 · 最近错选{' '}
                      {item.lastIncorrect.selectedOptionIds.join('、')}
                    </p>
                  </div>
                  <ArrowRight size={17} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
