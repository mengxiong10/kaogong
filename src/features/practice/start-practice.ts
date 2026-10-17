import {
  contentRepository,
  ensureModuleBank,
  practiceRepository,
} from '@/data';
import { dataAnalysisBankPointId } from '@/domain/content-ids';
import { PracticeSessionSchema } from '@/domain/practice';
import type { Question } from '@/domain/questions';

async function createPractice(questions: Question[], keepOneMaterial = false) {
  const eligible = questions.filter(
    (question) => question.reviewStatus === 'source-provided',
  );
  eligible.sort(
    (a, b) =>
      Number(b.source.region === '湖北') - Number(a.source.region === '湖北') ||
      (b.source.year ?? 0) - (a.source.year ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const groups = new Map<string, Question[]>();
  if (keepOneMaterial) {
    for (const question of eligible) {
      const key = question.materialRef
        ? `${question.materialRef.id}@${question.materialRef.version}`
        : question.id;
      groups.set(key, [...(groups.get(key) ?? []), question]);
    }
  } else groups.set('all', eligible);
  const batches = [...groups.values()].flatMap((group) => {
    const result: Question[][] = [];
    for (let index = 0; index < group.length; index += 5)
      result.push(group.slice(index, index + 5));
    return result;
  });
  if (!batches.length) throw new Error('题库尚无可练题目');
  const previous = await practiceRepository.getSessions();
  const used = new Set(
    previous.flatMap((item) => item.questionRefs.map((ref) => ref.id)),
  );
  const next =
    batches.find((batch) => batch.some((item) => !used.has(item.id))) ??
    batches[0];
  if (!next) throw new Error('题库尚无可练题目');
  const session = PracticeSessionSchema.parse({
    id: crypto.randomUUID(),
    questionRefs: next.map(({ id, version }) => ({ id, version })),
    status: 'active',
    explanationMode: 'after-submit',
    currentIndex: 0,
    drafts: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  });
  await practiceRepository.createSession(session);
  return session.id;
}

export async function startKnowledgePointPractice(
  moduleId: string,
  pointId: string,
) {
  await ensureModuleBank(moduleId);
  return createPractice(await contentRepository.getTrainingQuestions(pointId));
}

export async function startModulePractice(
  moduleId: string,
  pointIds: string[],
) {
  await ensureModuleBank(moduleId);
  const lists = await Promise.all(
    pointIds.map((id) => contentRepository.getTrainingQuestions(id)),
  );
  const unique = new Map(
    lists.flat().map((question) => [question.id, question]),
  );
  return createPractice([...unique.values()]);
}

export async function startDataAnalysisPractice() {
  return createPractice(
    await contentRepository.getTrainingQuestions(dataAnalysisBankPointId),
    true,
  );
}

export async function startMistakePractice(questionIds: string[]) {
  if (
    questionIds.length < 1 ||
    questionIds.length > 5 ||
    new Set(questionIds).size !== questionIds.length
  )
    throw new Error('错题重做需要 1 至 5 道不同题目');
  const states = await practiceRepository.getMistakeStates();
  if (
    questionIds.some((id) => !states.some((state) => state.questionId === id))
  )
    throw new Error('只能重做已记录的错题');
  const questions = await Promise.all(
    questionIds.map((id) => contentRepository.getLatestTrainingQuestion(id)),
  );
  if (questions.some((question) => !question))
    throw new Error('部分错题没有可练习的版本');
  const session = PracticeSessionSchema.parse({
    id: crypto.randomUUID(),
    questionRefs: questions.map((question) => ({
      id: question!.id,
      version: question!.version,
    })),
    status: 'active',
    explanationMode: 'after-submit',
    currentIndex: 0,
    drafts: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  });
  await practiceRepository.createSession(session);
  return session.id;
}
