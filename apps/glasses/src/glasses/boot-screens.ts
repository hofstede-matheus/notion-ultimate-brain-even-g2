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

export const setupNeededScreen = makeBootScreen(
  'ULTIMATE BRAIN\n\nSetup needed.\nContinue on your phone to add\nyour Notion token and databases.',
);

export const bootErrorScreen = makeBootScreen(
  "ULTIMATE BRAIN\n\nCan't connect.\nCheck the Even Hub app on your\nphone, then retry.",
);
