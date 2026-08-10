import type { ScreenModule } from './types';

function makeBootScreen(content: string): ScreenModule {
  return {
    display: () => ({ mode: 'text', content }),
    action: (action, _snapshot, ctx) => {
      if (action.type === 'GO_BACK') ctx.shutdown();
    },
  };
}

export const bootingScreen = makeBootScreen('ULTIMATE BRAIN\n\nStarted.\nLoading your menu…');
