import { create } from 'zustand';

function readTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('kaogong-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* 主题存储不可用时仍可使用本次会话。 */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export const useUiStore = create<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>((set) => ({
  theme: readTheme(),
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('kaogong-theme', theme);
      } catch {
        /* 不阻断界面切换。 */
      }
      return { theme };
    }),
}));
