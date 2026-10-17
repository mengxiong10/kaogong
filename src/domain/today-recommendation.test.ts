import { describe, expect, it } from 'vitest';
import catalogJson from '../content/catalog.json';
import growthRate from '../content/growth-rate.json';
import { session } from '../data/test-fixtures';
import type { AnalyticsSnapshot } from './analytics';
import { LessonSchema } from './catalog';
import { recommendToday } from './today-recommendation';
import { CatalogSchema } from './validate-catalog';

const lesson = LessonSchema.parse(growthRate.lessons[0]);
const catalog = {
  ...CatalogSchema.parse(catalogJson),
  lessons: [lesson],
};

function snapshot(): AnalyticsSnapshot {
  return {
    answers: [],
    sessions: [],
    questions: [],
    lessonProgress: [],
    mistakes: [],
  };
}

describe('今日学习建议', () => {
  it('先推荐未完成课程，未交卷练习保留独立入口', () => {
    const records = snapshot();
    records.sessions = [session];
    records.mistakes = [
      {
        questionId: 'wrong-1',
        status: 'pending',
        reason: null,
        updatedAt: '2026-10-17T10:00:00.000Z',
      },
    ];
    expect(recommendToday(catalog, records)).toMatchObject({
      title: lesson.title,
      href: `/learn/data-analysis/${lesson.knowledgePointId}`,
      activeSession: { id: session.id, current: 1, total: 1 },
    });
  });

  it('课程完成后推荐错题，待复习清零后推荐真题', () => {
    const records = snapshot();
    records.lessonProgress = [
      {
        lessonId: lesson.id,
        lessonVersion: lesson.version,
        status: 'completed',
        updatedAt: '2026-10-17T10:00:00.000Z',
      },
    ];
    records.mistakes = [
      {
        questionId: 'wrong-1',
        status: 'pending',
        reason: null,
        updatedAt: '2026-10-17T10:00:00.000Z',
      },
    ];
    expect(recommendToday(catalog, records).href).toBe('/mistakes');
    records.mistakes[0]!.status = 'mastered';
    expect(recommendToday(catalog, records).href).toBe('/practice');
  });

  it('新版课程未完成时继续推荐课程', () => {
    const records = snapshot();
    records.lessonProgress = [
      {
        lessonId: lesson.id,
        lessonVersion: lesson.version - 1,
        status: 'completed',
        updatedAt: '2026-10-17T10:00:00.000Z',
      },
    ];
    expect(recommendToday(catalog, records).href).toContain(
      lesson.knowledgePointId,
    );
  });
});
