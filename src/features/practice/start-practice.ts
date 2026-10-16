import { contentRepository, practiceRepository } from '@/data';
import { growthRatePointId } from '@/data/growth-rate-content';
import { buildGrowthRateSession } from '@/domain/practice-flow';

export async function startGrowthRatePractice() {
  const questions =
    await contentRepository.getTrainingQuestions(growthRatePointId);
  const session = buildGrowthRateSession(
    questions,
    crypto.randomUUID(),
    new Date().toISOString(),
  );
  await practiceRepository.createSession(session);
  return session.id;
}
