import { Button } from 'even-toolkit/web/button';
import { ScreenHeader } from 'even-toolkit/web/screen-header';
import { StatusDot } from 'even-toolkit/web/status-dot';
import { useUiState } from '../hooks/useUiState';
import { triggerConnect } from '../providers/uiController';

export function StatusScreen() {
  const ui = useUiState();

  return (
    <div>
      <ScreenHeader title="GlassTask" />
      <div className="flex items-center gap-2 mb-4">
        <StatusDot connected={ui.connected} />
        <p className="text-[15px] text-text-dim">{ui.status}</p>
      </div>
      {ui.connect.visible && (
        <Button variant="highlight" disabled={ui.connect.disabled} onClick={() => triggerConnect()}>
          {ui.connect.label}
        </Button>
      )}
    </div>
  );
}
