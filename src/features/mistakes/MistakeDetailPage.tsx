import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/app/catalog-context';
import { contentRepository, practiceRepository } from '@/data';
import type { MistakeReviewItem } from '@/data/practice-repository';
import type { QuestionMaterial } from '@/domain/questions';
import type { MistakeState } from '@/domain/learning';
import { startMistakePractice } from '@/features/practice/start-practice';
import {
  InlineMarkdownContent,
  MarkdownContent,
} from '@/features/learn/MarkdownContent';

const reasons: { value: MistakeState['reason']; label: string }[] = [
  { value: null, label: '暂不填写' },
  { value: 'knowledge', label: '知识点不会' },
  { value: 'formula', label: '公式记错' },
  { value: 'reading', label: '审题错误' },
  { value: 'calculation', label: '计算失误' },
  { value: 'time', label: '耗时过长' },
  { value: 'other', label: '其他' },
];

export function MistakeDetailPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const { modules, knowledgePoints } = useCatalog();
  const [item, setItem] = useState<MistakeReviewItem | null>(null);
  const [material, setMaterial] = useState<QuestionMaterial | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const found = (await practiceRepository.getMistakeReviewItems()).find(
          (entry) => entry.state.questionId === questionId,
        );
        if (!found) throw new Error('错题不存在');
        const [attached, latest] = await Promise.all([
          found.question.materialRef
            ? contentRepository.getMaterial(found.question.materialRef)
            : Promise.resolve(undefined),
          contentRepository.getLatestTrainingQuestion(found.state.questionId),
        ]);
        if (found.question.materialRef && !attached)
          throw new Error('历史材料版本缺失');
        if (active) {
          setItem(found);
          setMaterial(attached ?? null);
          setCanRetry(Boolean(latest));
        }
      } catch {
        if (active) setError('错题详情暂时无法读取，请返回错题本。');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [questionId]);

  async function update(change: {
    status?: MistakeState['status'];
    reason?: MistakeState['reason'];
  }) {
    if (!item) return;
    setSaving(true);
    setError('');
    try {
      const state = await practiceRepository.updateMistakeState(
        item.state.questionId,
        change,
        new Date().toISOString(),
      );
      setItem({ ...item, state });
    } catch (cause) {
      console.error('错题状态保存失败', cause);
      setError('错题状态保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  async function retry() {
    if (!item) return;
    setSaving(true);
    setError('');
    try {
      navigate(
        `/practice/session/${await startMistakePractice([item.state.questionId])}`,
      );
    } catch {
      setError('这道错题暂时没有可练习的版本。');
      setSaving(false);
    }
  }

  if (loading)
    return (
      <p role="status" className="px-[22px] py-10">
        正在读取错题…
      </p>
    );
  if (!item)
    return (
      <div className="px-[22px] py-10">
        <p role="alert">{error}</p>
        <Link to="/mistakes" className="mt-5 inline-block text-primary">
          返回错题本
        </Link>
      </div>
    );

  const { question, state, lastIncorrect, history } = item;
  const points = knowledgePoints.filter((point) =>
    question.knowledgePointIds.includes(point.id),
  );
  const moduleTitle =
    modules.find((module) => module.id === points[0]?.moduleId)?.title ??
    '行测';

  return (
    <div className="px-[22px] pt-5 pb-10">
      <Link
        to="/mistakes"
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground"
      >
        <ArrowLeft size={16} />
        错题本
      </Link>
      <p className="mt-3 text-[10px] tracking-[1.2px] text-muted-foreground">
        {moduleTitle} · {points.map((point) => point.title).join('、')}
      </p>
      <h1 className="mt-1 text-[24px] font-semibold">错题详情</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        答错 {item.incorrectCount} 次 · 最近答错于{' '}
        {new Date(lastIncorrect.answeredAt).toLocaleString('zh-CN')} · 历史版本{' '}
        {lastIncorrect.questionRef.version}
      </p>
      {material && (
        <div className="mt-5 rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold">
            共用资料 · 可横向滑动查看表格
          </p>
          <MarkdownContent>{material.bodyMarkdown}</MarkdownContent>
        </div>
      )}
      <div className="mt-5">
        <MarkdownContent>{question.stemMarkdown}</MarkdownContent>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {question.options.map((option) => (
          <li
            key={option.id}
            className={
              question.correctOptionIds.includes(option.id)
                ? 'font-semibold text-primary'
                : ''
            }
          >
            {option.id}.{' '}
            <InlineMarkdownContent>{option.bodyMarkdown}</InlineMarkdownContent>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs">
        最近错选：{lastIncorrect.selectedOptionIds.join('、')} · 正确答案：{' '}
        {question.correctOptionIds.join('、')}
      </p>
      <div className="mt-4 border-t border-border pt-4">
        <h2 className="text-sm font-semibold">解析</h2>
        <MarkdownContent>{question.explanationMarkdown}</MarkdownContent>
        {question.reviewStatus === 'source-provided' && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {question.source.title} · 来源答案，未独立核验
          </p>
        )}
      </div>
      <section
        className="mt-7 border-t border-border pt-5"
        aria-labelledby="reason-title"
      >
        <h2 id="reason-title" className="text-sm font-semibold">
          这次错误的原因
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {reasons.map((reason) => (
            <Button
              key={reason.value ?? 'none'}
              variant={state.reason === reason.value ? 'secondary' : 'outline'}
              aria-pressed={state.reason === reason.value}
              disabled={saving}
              onClick={() => void update({ reason: reason.value })}
            >
              {reason.label}
            </Button>
          ))}
        </div>
      </section>
      <section
        className="mt-7 border-t border-border pt-5"
        aria-labelledby="history-title"
      >
        <h2 id="history-title" className="text-sm font-semibold">
          作答历史
        </h2>
        <ul className="mt-3 divide-y divide-border text-xs">
          {[...history].reverse().map((answer) => (
            <li
              key={answer.id}
              className="flex min-h-12 items-center justify-between gap-2 py-2"
            >
              <span>
                第 {answer.attemptNumber} 次 ·{' '}
                {answer.outcome === 'correct'
                  ? '正确'
                  : answer.outcome === 'incorrect'
                    ? '错误'
                    : '未作答'}{' '}
                · 版本 {answer.questionRef.version} ·{' '}
                {new Date(answer.answeredAt).toLocaleString('zh-CN')}
              </span>
              <Link
                to={`/practice/result/${answer.sessionId}`}
                className="inline-flex min-h-11 shrink-0 items-center text-primary"
              >
                查看结果 <ArrowRight size={14} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-7 space-y-3">
        <Button
          className="min-h-11 w-full"
          disabled={saving || !canRetry}
          onClick={() => void retry()}
        >
          重做这道题
        </Button>
        {!canRetry && (
          <p className="text-xs text-muted-foreground">
            当前没有可练习的题目版本，历史记录仍可查看。
          </p>
        )}
        <Button
          variant="outline"
          className="min-h-11 w-full"
          disabled={saving}
          onClick={() =>
            void update({
              status: state.status === 'pending' ? 'mastered' : 'pending',
            })
          }
        >
          {state.status === 'pending' ? '标记已掌握' : '重新标记待复习'}
        </Button>
      </div>
    </div>
  );
}
