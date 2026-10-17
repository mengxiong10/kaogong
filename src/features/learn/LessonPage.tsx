import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/app/catalog-context';
import { catalogRepository } from '@/data';
import type { LessonProgress } from '@/domain/learning';
import { startKnowledgePointPractice } from '../practice/start-practice';
import { MarkdownContent } from './MarkdownContent';
import { NotFoundPage } from './NotFoundPage';

export function LessonPage() {
  const { moduleId, knowledgePointId } = useParams();
  const { lessons, knowledgePoints, modules } = useCatalog();
  const point = knowledgePoints.find(
    (item) => item.id === knowledgePointId && item.moduleId === moduleId,
  );
  const module = modules.find((item) => item.id === moduleId);
  const navigate = useNavigate();
  const lesson = lessons
    .filter(
      (item) =>
        item.knowledgePointId === knowledgePointId &&
        ((item.reviewStatus === 'verified' &&
          item.source.license.status === 'permitted') ||
          (item.reviewStatus === 'source-derived' &&
            item.source.license.status === 'unknown')),
    )
    .sort((a, b) => b.version - a.version)[0];
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    let active = true;
    catalogRepository
      .getLessonProgress()
      .then(async (items) => {
        const saved = items.find((item) => item.lessonId === lesson.id);
        if (saved?.lessonVersion === lesson.version) {
          if (active) setProgress(saved);
        } else {
          const next: LessonProgress = {
            lessonId: lesson.id,
            lessonVersion: lesson.version,
            status: 'learning',
            updatedAt: new Date().toISOString(),
          };
          await catalogRepository.saveLessonProgress(next);
          if (active) setProgress(next);
        }
      })
      .catch(() => {
        if (active) setError('学习进度暂时无法保存，请稍后重试。');
      });
    return () => {
      active = false;
    };
  }, [lesson]);

  if (!point || !module || !lesson) return <NotFoundPage />;

  async function complete() {
    if (!lesson) return;
    try {
      const next: LessonProgress = {
        lessonId: lesson.id,
        lessonVersion: lesson.version,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      };
      await catalogRepository.saveLessonProgress(next);
      setProgress(next);
      setError('');
    } catch {
      setError('学习进度暂时无法保存，请稍后重试。');
    }
  }

  async function start() {
    if (!module || !point) return;
    setStarting(true);
    try {
      const id = await startKnowledgePointPractice(module.id, point.id);
      navigate(`/practice/session/${id}`);
    } catch {
      setError('练习暂时无法创建，请稍后重试。');
      setStarting(false);
    }
  }

  return (
    <article className="px-[22px] pt-[28px] pb-8">
      <Link
        to={`/learn/${module.id}`}
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={16} />
        {module.title}目录
      </Link>
      <h1 className="text-[25px] leading-[1.4] font-semibold">
        {lesson.title}
      </h1>
      <div className="mt-5 border-t border-border pt-1">
        <MarkdownContent>{lesson.bodyMarkdown}</MarkdownContent>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-8 space-y-3 border-t border-border pt-6">
        <Button
          variant="outline"
          className="min-h-11 w-full"
          onClick={complete}
        >
          <CheckCircle2 />
          {progress?.status === 'completed' ? '已完成课程' : '标记课程已学完'}
        </Button>
        <Button className="min-h-11 w-full" onClick={start} disabled={starting}>
          {starting ? '正在准备练习…' : '开始练习真题'}
          <ArrowRight />
        </Button>
      </div>
    </article>
  );
}
