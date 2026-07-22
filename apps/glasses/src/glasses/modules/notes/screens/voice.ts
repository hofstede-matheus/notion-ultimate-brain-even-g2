import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const voiceNotesScreen: ScreenModule = makeListScreen({
  screen: 'notes-voice',
  parent: 'notes-menu',
  title: 'VOICE NOTES',
  emptyMessage: 'No voice notes.',
});
