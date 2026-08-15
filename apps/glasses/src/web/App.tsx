import { IcChevronBack, IcMenuGear } from 'even-toolkit/web/icons/svg-icons';
import { NavHeader } from 'even-toolkit/web/nav-header';
import { useRef, useState } from 'react';
import { APP_DISPLAY_NAME } from '../app-info';
import { PageStack } from './components/PageStack';
import { useUiState } from './hooks/useUiState';
import { cancelSettings, triggerSettings } from './providers/uiController';
import { isDebugLogVisible, nextUnlockTap } from './screens/SettingsForm/debugLogUnlock';
import { SettingsForm } from './screens/SettingsForm/SettingsForm';
import { StatusScreen } from './screens/StatusScreen';

/**
 * Hand-rolled equivalent of even-toolkit's AppShell (fixed header + scrollable
 * body) — reproduced here rather than imported from the `even-toolkit/web`
 * barrel, since AppShell has no dedicated subpath export and the barrel
 * transitively pulls in the chart components' `recharts` dependency.
 */
export function App() {
  const ui = useUiState();
  const screenKey = ui.settingsOpen ? 'settings' : 'status';
  const [logUnlocked, setLogUnlocked] = useState(false);
  const tapCount = useRef(0);
  const showLog = isDebugLogVisible(logUnlocked);

  function handleVersionTap(): void {
    const { count, unlocked } = nextUnlockTap(tapCount.current);
    tapCount.current = count;
    if (unlocked) setLogUnlocked(true);
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <div className="shrink-0 bg-bg">
        <NavHeader
          title={ui.settingsOpen ? 'Notion Settings' : APP_DISPLAY_NAME}
          left={
            ui.settingsOpen && ui.settingsCancellable ? (
              <button type="button" onClick={() => cancelSettings()} aria-label="Back">
                <IcChevronBack width={24} height={24} className="text-text" />
              </button>
            ) : undefined
          }
          right={
            ui.settingsOpen ? undefined : (
              <button type="button" onClick={() => triggerSettings()} aria-label="Settings">
                <IcMenuGear width={24} height={24} className="text-text" />
              </button>
            )
          }
        />
      </div>
      <div className="flex-1 min-h-0">
        <PageStack screenKey={screenKey} direction={ui.navDirection}>
          {ui.settingsOpen ? (
            <SettingsForm showLog={showLog} onVersionTap={handleVersionTap} />
          ) : (
            <StatusScreen />
          )}
        </PageStack>
      </div>
    </div>
  );
}
