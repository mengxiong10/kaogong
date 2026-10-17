import { useEffect, useState } from 'react';
import { useCatalog } from '@/app/catalog-context';
import { analyticsRepository } from '@/data';
import { summarizeLearningReport } from '@/domain/analytics';
import type { AnalyticsSnapshot } from '@/domain/analytics';

export function useAnalyticsReport() {
  const catalog = useCatalog();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | {
        status: 'ready';
        report: ReturnType<typeof summarizeLearningReport>;
        snapshot: AnalyticsSnapshot;
      }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    analyticsRepository
      .getSnapshot()
      .then((snapshot) => {
        if (active)
          setState({
            status: 'ready',
            report: summarizeLearningReport(snapshot, catalog),
            snapshot,
          });
      })
      .catch((error: unknown) => {
        console.error('学习报告读取失败', error);
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [catalog]);

  return state;
}

export function formatAccuracy(accuracy: number | null) {
  return accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`;
}

export function formatMedian(ms: number | null) {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1)} 秒`;
}
