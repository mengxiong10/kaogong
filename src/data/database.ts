import Dexie, { type Table } from 'dexie';
import type {
  ExamProfile,
  KnowledgePoint,
  Lesson,
  Module,
} from '../domain/catalog';
import type {
  AnswerRecord,
  LessonProgress,
  MistakeState,
} from '../domain/learning';
import type { PracticeSession } from '../domain/practice';
import type { Question, QuestionMaterial } from '../domain/questions';

/** 仅 data 层使用表；页面通过仓储访问。 */
export class LearningDatabase extends Dexie {
  examProfiles!: Table<ExamProfile, string>;
  modules!: Table<Module, string>;
  knowledgePoints!: Table<KnowledgePoint, string>;
  lessons!: Table<Lesson, [string, number]>;
  lessonProgress!: Table<LessonProgress, string>;
  questions!: Table<Question, [string, number]>;
  materials!: Table<QuestionMaterial, [string, number]>;
  sessions!: Table<PracticeSession, string>;
  answers!: Table<AnswerRecord, string>;
  mistakes!: Table<MistakeState, string>;
  metadata!: Table<{ key: string; value: string }, string>;

  constructor(name = 'kaogong-learning') {
    super(name);
    this.version(1).stores({
      examProfiles: 'id',
      modules: 'id, examProfileId, order',
      knowledgePoints: 'id, moduleId, parentId, [moduleId+parentId]',
      lessons: '[id+version], id, knowledgePointId',
      lessonProgress: 'lessonId, status',
      questions: '[id+version], id, *knowledgePointIds, reviewStatus',
      materials: '[id+version], id',
      sessions: 'id, status, startedAt',
      answers:
        'id, sessionId, questionRef.id, &[sessionId+questionRef.id], answeredAt',
      mistakes: 'questionId, status',
      metadata: 'key',
    });
  }
}
