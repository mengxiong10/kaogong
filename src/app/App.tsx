import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  BookOpen,
  House,
  Moon,
  Sun,
  BookOpenCheck,
  PencilLine,
  BookMarked,
} from 'lucide-react';
import { catalogRepository, initializeLocalData } from '../data';
import type { CatalogView } from '../domain/validate-catalog';
import { Button } from '../components/ui/button';
import { CatalogContext } from './catalog-context';
import { useUiStore } from './ui-store';
import { HomePage } from '../features/home/HomePage';
import { KnowledgePage } from '../features/learn/KnowledgePage';
import { ModulePage } from '../features/learn/ModulePage';
import { NotFoundPage } from '../features/learn/NotFoundPage';

const LessonPage = lazy(() =>
  import('../features/learn/LessonPage').then((module) => ({
    default: module.LessonPage,
  })),
);
const PracticeLandingPage = lazy(() =>
  import('../features/practice/PracticeLandingPage').then((module) => ({
    default: module.PracticeLandingPage,
  })),
);
const PracticeSessionPage = lazy(() =>
  import('../features/practice/PracticeSessionPage').then((module) => ({
    default: module.PracticeSessionPage,
  })),
);
const PracticeResultPage = lazy(() =>
  import('../features/practice/PracticeResultPage').then((module) => ({
    default: module.PracticeResultPage,
  })),
);
const MistakeListPage = lazy(() =>
  import('../features/mistakes/MistakeListPage').then((module) => ({
    default: module.MistakeListPage,
  })),
);
const MistakeDetailPage = lazy(() =>
  import('../features/mistakes/MistakeDetailPage').then((module) => ({
    default: module.MistakeDetailPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import('../features/analytics/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const BackupPage = lazy(() =>
  import('../features/backup/BackupPage').then((module) => ({
    default: module.BackupPage,
  })),
);

function AppShell() {
  const [state, setState] = useState<{
    status: 'loading' | 'error' | 'ready';
    catalog?: CatalogView;
  }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const theme = useUiStore((store) => store.theme);
  const toggleTheme = useUiStore((store) => store.toggleTheme);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#171c19' : '#f8f9f6');
  }, [theme]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    initializeLocalData()
      .then(() => catalogRepository.getCatalog())
      .then((catalog) => {
        if (active) setState({ status: 'ready', catalog });
      })
      .catch((error: unknown) => {
        console.error('本地数据初始化失败', error);
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-20 focus:bg-primary focus:p-3 focus:text-primary-foreground"
        href="#main"
      >
        跳至内容
      </a>
      <header className="flex items-center justify-between border-b border-border px-[22px] pt-[calc(17px+env(safe-area-inset-top))] pb-[17px]">
        <NavLink
          to="/"
          className="flex min-h-11 items-center gap-2.5 text-base leading-[1.35] font-semibold [&_small]:mt-[3px] [&_small]:block [&_small]:text-[10px] [&_small]:font-normal [&_small]:tracking-[1px] [&_small]:text-muted-foreground"
          aria-label="湖北行测首页"
        >
          <span className="grid h-[39px] w-[35px] place-items-center rounded-[7px] border border-primary text-primary">
            <BookOpenCheck size={21} />
          </span>
          <span>
            湖北行测<small>个人学习工作台</small>
          </span>
        </NavLink>
        <Button
          variant="ghost"
          className="size-11 p-0 text-foreground"
          aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
          onClick={toggleTheme}
        >
          {theme === 'light' ? <Moon /> : <Sun />}
        </Button>
      </header>
      <main
        className="pb-[calc(90px+env(safe-area-inset-bottom))] outline-none"
        id="main"
        tabIndex={-1}
        ref={mainRef}
      >
        {state.status === 'loading' && (
          <div
            className="px-[25px] py-[65px] [&>h1]:text-[21px] [&>h1]:font-semibold [&>p:not(.eyebrow)]:mt-3 [&>p:not(.eyebrow)]:mb-6 [&>p:not(.eyebrow)]:text-[13px] [&>p:not(.eyebrow)]:text-muted-foreground"
            role="status"
          >
            <span className="mb-5 block size-2 rounded-full bg-primary" />
            <h1>正在准备知识目录</h1>
            <p>首次打开将建立本地学习空间。</p>
          </div>
        )}
        {state.status === 'error' && (
          <div
            className="px-[25px] py-[65px] [&>h1]:text-[21px] [&>h1]:font-semibold [&>p:not(.eyebrow)]:mt-3 [&>p:not(.eyebrow)]:mb-6 [&>p:not(.eyebrow)]:text-[13px] [&>p:not(.eyebrow)]:text-muted-foreground"
            role="alert"
          >
            <h1>本地学习空间暂时不可用</h1>
            <p>
              请确认浏览器允许保存站点数据，再重试。重试会保留已有学习记录。
            </p>
            <Button
              className="min-h-11"
              onClick={() => setAttempt((count) => count + 1)}
            >
              重新尝试
            </Button>
          </div>
        )}
        {state.status === 'ready' && state.catalog && (
          <CatalogContext.Provider value={state.catalog}>
            <Suspense
              fallback={
                <p role="status" className="px-[22px] py-10 text-sm">
                  正在打开页面…
                </p>
              }
            >
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/backup" element={<BackupPage />} />
                <Route path="/learn" element={<KnowledgePage />} />
                <Route path="/learn/:moduleId" element={<ModulePage />} />
                <Route
                  path="/learn/:moduleId/:knowledgePointId"
                  element={<LessonPage />}
                />
                <Route path="/practice" element={<PracticeLandingPage />} />
                <Route path="/mistakes" element={<MistakeListPage />} />
                <Route
                  path="/mistakes/:questionId"
                  element={<MistakeDetailPage />}
                />
                <Route
                  path="/practice/session/:sessionId"
                  element={<PracticeSessionPage />}
                />
                <Route
                  path="/practice/result/:sessionId"
                  element={<PracticeResultPage />}
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </CatalogContext.Provider>
        )}
      </main>
      <nav
        className="fixed bottom-0 left-1/2 z-10 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-4 border-t border-border bg-background px-[12px] pt-[7px] pb-[calc(7px+env(safe-area-inset-bottom))] [&>a]:flex [&>a]:min-h-[51px] [&>a]:flex-col [&>a]:items-center [&>a]:justify-center [&>a]:gap-[3px] [&>a]:rounded-[5px] [&>a]:text-[10px] [&>a]:text-muted-foreground [&>a.active]:font-semibold [&>a.active]:text-primary"
        aria-label="主导航"
      >
        <NavLink to="/" end>
          <House size={21} />
          <span>首页</span>
        </NavLink>
        <NavLink to="/learn">
          <BookOpen size={21} />
          <span>知识体系</span>
        </NavLink>
        <NavLink to="/practice">
          <PencilLine size={21} />
          <span>专项练习</span>
        </NavLink>
        <NavLink to="/mistakes">
          <BookMarked size={21} />
          <span>错题本</span>
        </NavLink>
      </nav>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
