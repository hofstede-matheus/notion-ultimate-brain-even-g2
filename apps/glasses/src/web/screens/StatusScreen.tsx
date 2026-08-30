import { Button } from 'even-toolkit/web/button';
import { ScreenHeader } from 'even-toolkit/web/screen-header';
import { StatusDot } from 'even-toolkit/web/status-dot';
import { useEffect, useState } from 'react';
import { APP_DISPLAY_NAME } from '../../app-info';
import { useUiState } from '../hooks/useUiState';
import { triggerConnect } from '../providers/uiController';
import { dismissWhatsNew, isDismissed, loadDismissedWhatsNew, WHATS_NEW_ENTRY } from '../whats-new';
import { WhatsNew } from './components/WhatsNew';

export function StatusScreen() {
  const ui = useUiState();
  // Starts hidden and flips on once the dismissed-ids read resolves — a storage read is async
  // (bridge or localStorage), and there's nothing sensible to show optimistically that isn't
  // either a flash of the card or a flash of it disappearing a moment later.
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDismissedWhatsNew().then((dismissed) => {
      if (!cancelled) setShowWhatsNew(!isDismissed(dismissed, WHATS_NEW_ENTRY.id));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDismissWhatsNew(): void {
    setShowWhatsNew(false);
    void dismissWhatsNew(WHATS_NEW_ENTRY.id);
  }

  return (
    <div>
      <ScreenHeader title={APP_DISPLAY_NAME} />
      {showWhatsNew && <WhatsNew onDismiss={handleDismissWhatsNew} />}
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
