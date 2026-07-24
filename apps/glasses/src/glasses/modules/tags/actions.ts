import { trace } from '../../../logging/trace';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { enterView } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Tag drill-down — reached by tapping a tag in any Tags list screen. There's
// no intermediate action menu (unlike Projects' project-detail): stash the
// tag and enter its notes list in one step.
// ---------------------------------------------------------------------------

export function openTagNotes(tagId: string, tagName: string, returnTo: ScreenName): void {
  trace.info('NAV', `openTagNotes "${tagName}"`, { id: tagId });
  state.selectedTag = { id: tagId, name: tagName, returnTo };
  void enterView('tag-notes');
}
