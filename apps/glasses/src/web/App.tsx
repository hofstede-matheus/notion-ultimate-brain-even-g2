import { IcMenuGear } from 'even-toolkit/web/icons/svg-icons';
import { NavHeader } from 'even-toolkit/web/nav-header';
import { useUiState } from './hooks/useUiState';
import { triggerSettings } from './providers/uiController';
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

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <div className="shrink-0 bg-bg">
        <NavHeader
          title="GlassTask"
          right={
            <button type="button" onClick={() => triggerSettings()} aria-label="Settings">
              <IcMenuGear width={24} height={24} className="text-text" />
            </button>
          }
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3">
        {ui.settingsOpen ? <SettingsForm /> : <StatusScreen />}
      </div>
    </div>
  );
}
