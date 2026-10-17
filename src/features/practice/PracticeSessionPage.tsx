import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Flag, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/app/catalog-context';
import { contentRepository, practiceRepository } from '@/data';
import type { PracticeSession } from '@/domain/practice';
import type { Question } from '@/domain/questions';
import { advanceSessionTime } from '@/domain/practice-flow';
import {
  InlineMarkdownContent,
  MarkdownContent,
} from '../learn/MarkdownContent';

function displayTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function PracticeSessionPage() {
  const { modules, knowledgePoints } = useCatalog();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sessionRef = useRef<PracticeSession | null>(null);
  const lastTick = useRef(performance.now());
  const wasVisible = useRef(document.visibilityState === 'visible');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);
  const saveFailed = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loaded = await practiceRepository.getSession(sessionId ?? '');
        if (!loaded) throw new Error('找不到练习');
        if (loaded.status === 'completed') {
          navigate(`/practice/result/${loaded.id}`, { replace: true });
          return;
        }
        const items = await Promise.all(
          loaded.questionRefs.map((ref) => contentRepository.getQuestion(ref)),
        );
        if (items.some((item) => !item))
          throw new Error('练习中的题目版本缺失');
        const materialEntries = await Promise.all(
          (items as Question[])
            .filter((item) => item.materialRef)
            .map(async (item) => {
              const material = await contentRepository.getMaterial(
                item.materialRef!,
              );
              if (!material) throw new Error('练习材料版本缺失');
              return [item.id, material.bodyMarkdown] as const;
            }),
        );
        if (active) {
          sessionRef.current = loaded;
          setSession(loaded);
          setQuestions(items as Question[]);
          setMaterials(Object.fromEntries(materialEntries));
          lastTick.current = performance.now();
          setLoading(false);
        }
      } catch {
        if (active) {
          setError('练习暂时无法打开，请返回练习列表。');
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [sessionId, navigate]);

  function commit(change?: (current: PracticeSession) => PracticeSession) {
    const current = sessionRef.current;
    if (!current || submittingRef.current) return;
    const now = performance.now();
    const delta = wasVisible.current
      ? Math.max(0, Math.round(now - lastTick.current))
      : 0;
    lastTick.current = now;
    const updated = advanceSessionTime(current, delta);
    const next = change ? change(updated) : updated;
    sessionRef.current = next;
    setSession(next);
    setSaving(true);
    const version = ++saveVersion.current;
    saveQueue.current = saveQueue.current
      .then(() => practiceRepository.saveSession(next))
      .then(() => {
        saveFailed.current = false;
        setError('');
        if (version === saveVersion.current) setSaving(false);
      })
      .catch(() => {
        saveFailed.current = true;
        setError('草稿保存失败，请检查浏览器存储后重试。');
        setSaving(false);
      });
  }

  useEffect(() => {
    if (!session || loading) return;
    const timer = window.setInterval(() => {
      if (wasVisible.current) commit();
    }, 1000);
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        commit();
        wasVisible.current = false;
      } else {
        wasVisible.current = true;
        lastTick.current = performance.now();
      }
    }
    const onPageHide = () => commit();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      commit();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
    // The session is held in a ref so the timer is not recreated on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, Boolean(session)]);

  async function submit() {
    commit();
    submittingRef.current = true;
    setSubmitting(true);
    await saveQueue.current;
    if (saveFailed.current) {
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }
    try {
      await practiceRepository.submitSession(
        sessionId!,
        new Date().toISOString(),
      );
      navigate(`/practice/result/${sessionId}`, { replace: true });
    } catch {
      setError('交卷失败，答题记录未改变。请重试。');
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <p role="status" className="px-[22px] py-10 text-sm">
        正在恢复练习…
      </p>
    );
  if (!session)
    return (
      <div className="px-[22px] py-10">
        <p role="alert">{error}</p>
        <Link className="mt-5 inline-block text-primary" to="/practice">
          返回练习列表
        </Link>
      </div>
    );

  const index = session.currentIndex;
  const question = questions[index];
  if (!question) return null;
  const moduleId = knowledgePoints.find((point) =>
    question.knowledgePointIds.includes(point.id),
  )?.moduleId;
  const moduleTitle =
    modules.find((module) => module.id === moduleId)?.title ?? '行测';
  const draft = session.drafts.find(
    (item) => item.questionRef.id === question.id,
  );
  const answered = session.questionRefs.filter(
    (ref) =>
      session.drafts.find((item) => item.questionRef.id === ref.id)
        ?.selectedOptionIds.length,
  ).length;
  const totalTime = session.drafts.reduce(
    (sum, item) => sum + item.elapsedMs,
    0,
  );

  return (
    <div className="px-[22px] pt-5 pb-8">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/practice"
          className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground"
        >
          <ArrowLeft size={16} />
          练习
        </Link>
        <span
          className="text-xs text-muted-foreground tabular-nums"
          aria-label={`练习用时 ${displayTime(totalTime)}`}
        >
          {displayTime(totalTime)} · {saving ? '保存中' : '已保存'}
        </span>
      </div>
      <h1 className="mt-3 text-[22px] font-semibold">
        第 {index + 1} 题{' '}
        <span className="text-sm font-normal text-muted-foreground">
          / {questions.length}
        </span>
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {moduleTitle} · 已作答 {answered}/{questions.length}
      </p>
      <nav className="mt-5 grid grid-cols-5 gap-2" aria-label="题号导航">
        {questions.map((item, itemIndex) => {
          const itemDraft = session.drafts.find(
            (entry) => entry.questionRef.id === item.id,
          );
          return (
            <Button
              key={item.id}
              type="button"
              variant={
                itemIndex === index
                  ? 'default'
                  : itemDraft?.selectedOptionIds.length
                    ? 'secondary'
                    : 'outline'
              }
              className="min-h-11 px-0"
              aria-label={`第 ${itemIndex + 1} 题${itemDraft?.selectedOptionIds.length ? '已答' : '未答'}${itemDraft?.uncertain ? '，不确定' : ''}`}
              aria-current={itemIndex === index ? 'step' : undefined}
              onClick={() =>
                commit((current) => ({ ...current, currentIndex: itemIndex }))
              }
            >
              {itemIndex + 1}
              {itemDraft?.uncertain ? ' ·' : ''}
            </Button>
          );
        })}
      </nav>
      <section
        className="mt-7 border-t border-border pt-6"
        aria-labelledby="question-heading"
      >
        <h2 id="question-heading" className="sr-only">
          第 {index + 1} 题题干
        </h2>
        {materials[question.id] && (
          <div className="mb-6 rounded-md border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-semibold">
              共用资料 · 可横向滑动查看表格
            </p>
            <MarkdownContent>{materials[question.id] ?? ''}</MarkdownContent>
          </div>
        )}
        <MarkdownContent>{question.stemMarkdown}</MarkdownContent>
        {question.reviewStatus === 'source-provided' && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {question.source.url ? (
              <a
                className="underline"
                href={question.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {question.source.title}
              </a>
            ) : (
              question.source.title
            )}{' '}
            · 来源答案，未独立核验
          </p>
        )}
        <div className="mt-6 space-y-3" role="group" aria-label="选择答案">
          {question.options.map((option) => {
            const selected =
              draft?.selectedOptionIds.includes(option.id) ?? false;
            return (
              <Button
                key={option.id}
                type="button"
                variant={selected ? 'default' : 'outline'}
                aria-pressed={selected}
                onClick={() =>
                  commit((current) => ({
                    ...current,
                    drafts: current.drafts.map((item) =>
                      item.questionRef.id === question.id
                        ? { ...item, selectedOptionIds: [option.id] }
                        : item,
                    ),
                  }))
                }
                className="h-auto min-h-12 w-full justify-start py-3 text-left whitespace-normal"
              >
                <span className="mr-3 w-5 shrink-0 font-semibold">
                  {option.id}
                </span>
                <InlineMarkdownContent>
                  {option.bodyMarkdown}
                </InlineMarkdownContent>
              </Button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className="min-h-11 text-muted-foreground"
            onClick={() =>
              commit((current) => ({
                ...current,
                drafts: current.drafts.map((item) =>
                  item.questionRef.id === question.id
                    ? { ...item, selectedOptionIds: [] }
                    : item,
                ),
              }))
            }
          >
            跳过 / 清除答案
          </Button>
          <Button
            variant={draft?.uncertain ? 'secondary' : 'ghost'}
            className="min-h-11"
            aria-pressed={draft?.uncertain ?? false}
            onClick={() =>
              commit((current) => ({
                ...current,
                drafts: current.drafts.map((item) =>
                  item.questionRef.id === question.id
                    ? { ...item, uncertain: !item.uncertain }
                    : item,
                ),
              }))
            }
          >
            <Flag />
            {draft?.uncertain ? '已标记不确定' : '标记不确定'}
          </Button>
        </div>
      </section>
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-7 flex gap-2 border-t border-border pt-5">
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          disabled={index === 0}
          onClick={() =>
            commit((current) => ({
              ...current,
              currentIndex: current.currentIndex - 1,
            }))
          }
        >
          <ArrowLeft />
          上一题
        </Button>
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          disabled={index === questions.length - 1}
          onClick={() =>
            commit((current) => ({
              ...current,
              currentIndex: current.currentIndex + 1,
            }))
          }
        >
          下一题
          <ArrowRight />
        </Button>
      </div>
      <Button
        className="mt-4 min-h-11 w-full"
        disabled={submitting || saving}
        onClick={submit}
      >
        <Send />
        {submitting
          ? '正在交卷…'
          : `交卷并查看解析（${answered}/${questions.length} 已答）`}
      </Button>
    </div>
  );
}
