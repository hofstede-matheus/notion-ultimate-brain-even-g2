import { Button } from 'even-toolkit/web/button';
import { Card } from 'even-toolkit/web/card';
import type { ReleaseNotes } from '../../../build/changelog';

export interface WhatsNewProps {
  notes: ReleaseNotes;
  onDismiss: () => void;
}

/**
 * The status screen's "what's new" card — see ../../whats-new.ts for where the notes come from
 * and how dismissal is stored. Mirrors SettingsForm/components/LogConsole.tsx's heading + <Card>
 * idiom. Stays until the wearer taps "Got it" — no auto-expiry, no timer.
 */
export function WhatsNew({ notes, onDismiss }: WhatsNewProps) {
  return (
    <Card padding="sm" className="mb-4">
      <h2 className="text-[13px] tracking-[-0.13px] text-text-dim mb-2">What's new</h2>
      {notes.groups.map((group) => (
        <section key={group.heading} className="mb-3">
          <h3 className="text-[13px] text-text-dim mb-1">{group.heading}</h3>
          <ul className="list-disc pl-4 space-y-1">
            {group.bullets.map((bullet) => (
              <li key={bullet} className="text-[13px] text-text">
                {bullet}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
        Got it
      </Button>
    </Card>
  );
}
