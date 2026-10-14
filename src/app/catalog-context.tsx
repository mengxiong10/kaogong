import { createContext, useContext } from 'react';
import type { CatalogView } from '../domain/validate-catalog';

export const CatalogContext = createContext<CatalogView | null>(null);
export function useCatalog() {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error('知识目录尚未初始化');
  return catalog;
}
