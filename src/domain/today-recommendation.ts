import type { AnalyticsSnapshot } from './analytics';
import type { CatalogView } from './validate-catalog';

export type TodayRecommendation = {
  title: string;
  detail: string;
  action: string;
  href: string;
  activeSession?: { id: string; current: number; total: number };
};

export function recommendToday(
  catalog: CatalogView,
  snapshot: AnalyticsSnapshot,
): TodayRecommendation {
  const latestLessons = new Map(
    [...catalog.lessons]
      .sort((a, b) => a.version - b.version)
      .map((lesson) => [lesson.knowledgePointId, lesson]),
  );
  const progress = new Map(
    snapshot.lessonProgress.map((item) => [item.lessonId, item]),
  );
  const eligible = catalog.knowledgePoints
    .filter((point) => point.kind !== 'category')
    .sort(
      (a, b) =>
        (catalog.modules.find((module) => module.id === a.moduleId)?.order ??
          0) -
          (catalog.modules.find((module) => module.id === b.moduleId)?.order ??
            0) ||
        a.order - b.order ||
        a.id.localeCompare(b.id),
    )
    .flatMap((point) => {
      const lesson = latestLessons.get(point.id);
      if (!lesson) return [];
      const state = progress.get(lesson.id);
      const completed =
        state?.lessonVersion === lesson.version &&
        (state.status === 'completed' || state.status === 'basic-mastery');
      return completed ? [] : [{ point, lesson, state }];
    });
  const next =
    eligible
      .filter(
        ({ lesson, state }) =>
          state?.lessonVersion === lesson.version &&
          state.status === 'learning',
      )
      .sort((a, b) =>
        (b.state?.updatedAt ?? '').localeCompare(a.state?.updatedAt ?? ''),
      )[0] ?? eligible[0];
  const active = snapshot.sessions
    .filter((session) => session.status === 'active')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const activeSession = active
    ? {
        id: active.id,
        current: active.currentIndex + 1,
        total: active.questionRefs.length,
      }
    : undefined;

  if (next) {
    const module = catalog.modules.find(
      (item) => item.id === next.point.moduleId,
    );
    return {
      title: next.lesson.title,
      detail: `${module?.title ?? '知识体系'} · ${next.state?.status === 'learning' && next.state.lessonVersion === next.lesson.version ? '接着学习这节课程' : '学习一节新课程'}`,
      action: '学习这节课程',
      href: `/learn/${next.point.moduleId}/${next.point.id}`,
      activeSession,
    };
  }

  const pending = snapshot.mistakes.filter(
    (item) => item.status === 'pending',
  ).length;
  if (pending > 0)
    return {
      title: `复习 ${pending} 道待复习错题`,
      detail: '课程已全部完成，回看答错的题目。',
      action: '去复习错题',
      href: '/mistakes',
      activeSession,
    };
  return {
    title: '练习行测真题',
    detail: '课程已全部完成，继续用真题巩固。',
    action: '去练习真题',
    href: '/practice',
    activeSession,
  };
}
