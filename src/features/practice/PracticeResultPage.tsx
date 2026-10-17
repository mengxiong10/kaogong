import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/app/catalog-context';
import { contentRepository, practiceRepository } from '@/data';
import type { AnswerRecord } from '@/domain/learning';
import type { PracticeSession } from '@/domain/practice';
import type { Question } from '@/domain/questions';
import {
  summarizeAnswers,
  summarizePracticeHistory,
} from '@/domain/practice-flow';
import {
  InlineMarkdownContent,
  MarkdownContent,
} from '../learn/MarkdownContent';

type Result = {
  session: PracticeSession;
  questions: Question[];
  materials: Record<string, string>;
  answers: AnswerRecord[];
  difficultyHistory: ReturnType<typeof summarizePracticeHistory>;
};

function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(1)} 秒`;
}

export function PracticeResultPage() {
  const { modules, knowledgePoints } = useCatalog();
  const { sessionId } = useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await practiceRepository.getSession(sessionId ?? '');
        if (!session || session.status !== 'completed')
          throw new Error('练习尚未交卷');
        const [answers, questions, allAnswers, allSessions] = await Promise.all(
          [
            practiceRepository.getAnswers(session.id),
            Promise.all(
              session.questionRefs.map((ref) =>
                contentRepository.getQuestion(ref),
              ),
            ),
            practiceRepository.getAnswers(),
            practiceRepository.getSessions(),
          ],
        );
        if (
          answers.length !== session.questionRefs.length ||
          questions.some((item) => !item)
        )
          throw new Error('练习结果不完整');
        const sessionPoints = new Set(
          (questions as Question[]).flatMap((item) => item.knowledgePointIds),
        );
        const materialEntries = await Promise.all(
          (questions as Question[])
            .filter((item) => item.materialRef)
            .map(async (item) => {
              const material = await contentRepository.getMaterial(
                item.materialRef!,
              );
              if (!material) throw new Error('练习材料版本缺失');
              return [item.id, material.bodyMarkdown] as const;
            }),
        );
        const sessionsById = new Map(
          allSessions.map((item) => [item.id, item]),
        );
        const observations = await Promise.all(
          allAnswers.map(async (record) => {
            const question = await contentRepository.getQuestion(
              record.questionRef,
            );
            if (!question) throw new Error('历史题目版本缺失');
            if (!question.knowledgePointIds.some((id) => sessionPoints.has(id)))
              return null;
            const draft = sessionsById
              .get(record.sessionId)
              ?.drafts.find(
                (item) => item.questionRef.id === record.questionRef.id,
              );
            return {
              difficulty: question.difficulty,
              outcome: record.outcome,
              elapsedMs: record.elapsedMs,
              attemptNumber: record.attemptNumber,
              uncertain: draft?.uncertain ?? false,
            };
          }),
        );
        const difficultyHistory = summarizePracticeHistory(
          observations.filter((item) => item !== null),
        );
        if (active)
          setResult({
            session,
            answers,
            questions: questions as Question[],
            materials: Object.fromEntries(materialEntries),
            difficultyHistory,
          });
      } catch {
        if (active) setError('练习结果暂时无法读取，请返回练习列表。');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  if (error)
    return (
      <div className="px-[22px] py-10">
        <p role="alert">{error}</p>
        <Link className="mt-5 inline-block text-primary" to="/practice">
          返回练习列表
        </Link>
      </div>
    );
  if (!result)
    return (
      <p role="status" className="px-[22px] py-10 text-sm">
        正在读取练习结果…
      </p>
    );
  const summary = summarizeAnswers(result.answers);
  const isBank = result.questions[0]?.reviewStatus === 'source-provided';
  const moduleId = knowledgePoints.find((point) =>
    result.questions[0]?.knowledgePointIds.includes(point.id),
  )?.moduleId;
  const moduleTitle =
    modules.find((module) => module.id === moduleId)?.title ?? '行测';
  return (
    <div className="px-[22px] pt-6 pb-10">
      <Link
        to="/practice"
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground"
      >
        <ArrowLeft size={16} />
        练习列表
      </Link>
      <h1 className="mt-3 text-[26px] font-semibold">练习结果</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {moduleTitle} · {isBank ? '真题' : '原创题'} · {summary.total} 题
      </p>
      <div className="mt-6 grid grid-cols-3 gap-2 border-y border-border py-5 text-center [&_span]:text-[11px] [&_span]:text-muted-foreground [&_strong]:block [&_strong]:text-xl [&_strong]:font-semibold">
        <div>
          <strong className="text-primary">{summary.correct}</strong>
          <span>正确</span>
        </div>
        <div>
          <strong>{summary.incorrect}</strong>
          <span>错误</span>
        </div>
        <div>
          <strong>{summary.unanswered}</strong>
          <span>未作答</span>
        </div>
      </div>
      <div className="mt-5 space-y-2 text-xs text-muted-foreground">
        <p>
          本套已答正确率：
          {summary.accuracy === null
            ? '暂无'
            : `${Math.round(summary.accuracy * 100)}%`}
        </p>
        <p>
          首次作答：{summary.firstCorrect}/{summary.firstAnswered}{' '}
          题正确；重复作答：{summary.repeatCorrect}/{summary.repeatAnswered}{' '}
          题正确。
        </p>
        <p>
          累计单题用时：{formatMs(summary.elapsedMs)}；已答题中位用时：
          {summary.medianAnsweredMs === null
            ? '暂无'
            : formatMs(summary.medianAnsweredMs)}
          。
        </p>
      </div>
      {summary.incorrect > 0 && (
        <Button asChild variant="outline" className="mt-5 min-h-11 w-full">
          <Link to="/mistakes">
            查看待复习错题 <ArrowRight />
          </Link>
        </Button>
      )}
      <details className="mt-7 border-y border-border py-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
          按难度看历史用时
        </summary>
        <div className="mt-2 space-y-3 pb-2">
          {result.difficultyHistory.map((row) => (
            <div
              key={row.difficulty}
              className="rounded-md border border-border p-3 text-xs leading-[1.8]"
            >
              <h3 className="font-semibold">
                {row.difficulty === 'easy'
                  ? '简单'
                  : row.difficulty === 'medium'
                    ? '中等'
                    : row.difficulty === 'hard'
                      ? '较难'
                      : '未标定'}
              </h3>
              <p>
                首次：{row.firstCorrect}/{row.firstAnswered} 正确 · 中位用时{' '}
                {row.firstMedianMs === null
                  ? '暂无'
                  : formatMs(row.firstMedianMs)}
              </p>
              <p>
                重复：{row.repeatCorrect}/{row.repeatAnswered} 正确 · 中位用时{' '}
                {row.repeatMedianMs === null
                  ? '暂无'
                  : formatMs(row.repeatMedianMs)}
              </p>
              <p className="text-muted-foreground">
                标记不确定 {row.uncertainCount} 次
              </p>
            </div>
          ))}
        </div>
      </details>
      <h2 className="mt-8 mb-2 text-base font-semibold">逐题解析</h2>
      <ol className="space-y-4">
        {result.session.questionRefs.map((ref, index) => {
          const question = result.questions[index]!;
          const record = result.answers.find(
            (item) => item.questionRef.id === ref.id,
          )!;
          return (
            <li key={ref.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <strong>
                  第 {index + 1} 题 ·{' '}
                  {record.outcome === 'correct'
                    ? '正确'
                    : record.outcome === 'incorrect'
                      ? '错误'
                      : '未作答'}
                </strong>
                <span className="text-muted-foreground">
                  {record.attemptNumber === 1
                    ? '首次作答'
                    : `第 ${record.attemptNumber} 次作答`}{' '}
                  · {formatMs(record.elapsedMs)}
                </span>
              </div>
              {result.materials[question.id] && (
                <details className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold">
                    查看共用资料
                  </summary>
                  <MarkdownContent>
                    {result.materials[question.id] ?? ''}
                  </MarkdownContent>
                </details>
              )}
              <div className="mt-3">
                <MarkdownContent>{question.stemMarkdown}</MarkdownContent>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
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
                    <InlineMarkdownContent>
                      {option.bodyMarkdown}
                    </InlineMarkdownContent>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs">
                你的答案：
                {record.selectedOptionIds.length
                  ? record.selectedOptionIds.join('、')
                  : '未作答'}{' '}
                · 正确答案：{question.correctOptionIds.join('、')}
              </p>
              <div className="mt-3 border-t border-border pt-2">
                <MarkdownContent>
                  {question.explanationMarkdown}
                </MarkdownContent>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {question.reviewStatus === 'source-provided' ? (
                  <>
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
                  </>
                ) : (
                  '知识点：增长率'
                )}
              </p>
              {record.outcome === 'incorrect' && (
                <Link
                  to={`/mistakes/${encodeURIComponent(question.id)}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs text-primary"
                >
                  查看这道错题 <ArrowRight size={15} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <Button asChild className="mt-8 min-h-11 w-full">
        <Link to="/practice">
          再练一套
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
