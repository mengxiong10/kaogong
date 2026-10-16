import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contentRepository, practiceRepository } from '@/data';
import { growthRatePointId } from '@/data/growth-rate-content';
import type { AnswerRecord } from '@/domain/learning';
import type { PracticeSession } from '@/domain/practice';
import type { Question } from '@/domain/questions';
import {
  summarizeAnswers,
  summarizePracticeHistory,
} from '@/domain/practice-flow';
import { MarkdownContent } from '../learn/MarkdownContent';

type Result = {
  session: PracticeSession;
  questions: Question[];
  answers: AnswerRecord[];
  difficultyHistory: ReturnType<typeof summarizePracticeHistory>;
};

function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(1)} 秒`;
}

export function PracticeResultPage() {
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
        const sessionsById = new Map(
          allSessions.map((item) => [item.id, item]),
        );
        const observations = await Promise.all(
          allAnswers.map(async (record) => {
            const question = await contentRepository.getQuestion(
              record.questionRef,
            );
            if (!question) throw new Error('历史题目版本缺失');
            if (!question.knowledgePointIds.includes(growthRatePointId))
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
  return (
    <div className="px-[22px] pt-6 pb-10">
      <Link
        to="/practice"
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground"
      >
        <ArrowLeft size={16} />
        练习列表
      </Link>
      <p className="mt-3 text-[10px] tracking-[1.2px] text-muted-foreground">
        资料分析 / 增长率 · 已交卷
      </p>
      <h1 className="mt-1 text-[26px] font-semibold">练习结果</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        本套 {summary.total} 题，已答 {summary.answered}{' '}
        题。正确率只以已答题为分母。
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
        <p>五题只提供本次反馈，尚不足以判断正确率是否稳定或识别薄弱模块。</p>
      </div>
      <section
        className="mt-8 border-t border-border pt-6"
        aria-labelledby="difficulty-title"
      >
        <h2 id="difficulty-title" className="text-base font-semibold">
          按难度看用时
        </h2>
        <p className="mt-2 text-xs leading-[1.7] text-muted-foreground">
          以下汇总本机增长率练习历史。首次和重复分别统计；未答题不计入正确率和中位用时。
        </p>
        <div className="mt-4 space-y-3">
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
                    : '较难'}
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
        <p className="mt-3 text-xs leading-[1.7] text-muted-foreground">
          同一题重复练习可能因记忆提速；需要更多不同题目和多次练习才能判断趋势。
        </p>
      </section>
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
              <div className="mt-3">
                <MarkdownContent>{question.stemMarkdown}</MarkdownContent>
              </div>
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
                知识点：增长率
              </p>
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
