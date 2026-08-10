import { Button } from 'even-toolkit/web/button';
import { ScreenHeader } from 'even-toolkit/web/screen-header';
import { StatusDot } from 'even-toolkit/web/status-dot';
import { APP_DISPLAY_NAME } from '../../app-info';
import { useUiState } from '../hooks/useUiState';
import { triggerConnect } from '../providers/uiController';

export function StatusScreen() {
  const ui = useUiState();

  return (
    <div>
      <ScreenHeader title={APP_DISPLAY_NAME} />
      <div className="flex items-center gap-2 mb-4">
        <StatusDot connected={ui.deviceConnected ?? ui.connected} />
        <p className="text-[15px] text-text-dim">{ui.status}</p>
      </div>
      {ui.deviceConnected === false && (
        <p className="text-[15px] text-negative mb-4">
          Glasses disconnected — reconnect in the Even app.
        </p>
      )}
      {ui.connect.visible && (
        <Button variant="highlight" disabled={ui.connect.disabled} onClick={() => triggerConnect()}>
          {ui.connect.label}
        </Button>
      )}
    </div>
  );
}
