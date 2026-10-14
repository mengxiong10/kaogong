import { LearningDatabase } from './database';
import { CatalogRepository } from './catalog-repository';
import { ContentRepository } from './content-repository';
import { PracticeRepository } from './practice-repository';
import { initializeDatabase } from './initialize';

const database = new LearningDatabase();
export const catalogRepository = new CatalogRepository(database);
export const contentRepository = new ContentRepository(database);
export const practiceRepository = new PracticeRepository(database);
export const initializeLocalData = () => initializeDatabase(database);
