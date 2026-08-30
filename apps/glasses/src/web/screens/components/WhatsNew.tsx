import { Button } from 'even-toolkit/web/button';
import { Card } from 'even-toolkit/web/card';
import { WHATS_NEW_ENTRY } from '../../whats-new';

export interface WhatsNewProps {
  onDismiss: () => void;
}

/**
 * The status screen's "what's new" card — see ../../whats-new.ts for the entry data and its
 * dismissed-state persistence. Mirrors SettingsForm/components/LogConsole.tsx's heading + <Card>
 * idiom. Stays until the wearer taps "Got it" — no auto-expiry, no timer.
 */
export function WhatsNew({ onDismiss }: WhatsNewProps) {
  return (
    <Card padding="sm" className="mb-4">
      <h2 className="text-[13px] tracking-[-0.13px] text-text-dim mb-2">{WHATS_NEW_ENTRY.title}</h2>
      <ul className="list-disc pl-4 mb-3 space-y-1">
        {WHATS_NEW_ENTRY.bullets.map((bullet) => (
          <li key={bullet} className="text-[13px] text-text">
            {bullet}
          </li>
        ))}
      </ul>
      <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
        Got it
      </Button>
    </Card>
  );
}
