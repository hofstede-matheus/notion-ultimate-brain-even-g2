import { pxTruncate } from 'even-toolkit/pretext';
import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { AppState, ScreenName } from '../../../state';
import { CONTAINER_PADDING, SCREEN_W } from '../../constants';
import type { ScreenModule } from '../../types';

/** Inner width of the full-screen text container a details screen renders into. */
const TEXT_INNER_W = SCREEN_W - 2 * CONTAINER_PADDING;
const BACK_HINT = 'Double-tap to go back.';

/** One labelled line pair — the label, then its value on the line below. */
export interface DetailsField {
  /** e.g. "Project:" — shown as its own line. */
  label: string;
  /** Shown in full on the next line; never truncated (see makeDetailsScreen). */
  value: string;
}

/** What a details screen needs to know about the item it is describing. */
export interface DetailsData {
  loading: boolean;
  /** Non-empty when the fetch failed — replaces the fields. */
  error: string;
  fields: DetailsField[];
}

export interface DetailsScreenConfig {
  /** Header title, e.g. "TASK DETAILS". */
  title: string;
  /** Screen to return to on GO_BACK — the list the item was selected from. Can depend on
   * state (e.g. task-details reads it off state.selectedTask.returnTo, since there's no
   * longer an intermediate action-menu screen to fall back on). */
  parent: ScreenName | ((state: AppState) => ScreenName);
  /** Reads this screen's slice of state; null before the fetch was started. */
  read(state: AppState): DetailsData | null;
}

/**
 * Generic factory for an item's details screen (a task's, a note's). Values
 * go on their own line under their label and are printed in full: a name too
 * long for a list row is exactly what someone opens this screen to read, so
 * it wraps and the text container scrolls rather than being cut short.
 *
 * The one thing that is truncated is a failed fetch's message — it is
 * unbounded server text, and overflow there would re-arm the firmware's
 * internal scroll on a screen whose only remaining move is going back.
 */
export function makeDetailsScreen(config: DetailsScreenConfig): ScreenModule {
  return {
    display(state) {
      const details = config.read(state);

      if (!details || details.loading) {
        return {
          mode: 'text',
          content: [
            buildHeaderLine(config.title, state.spinnerFrame),
            '',
            'Loading…',
            '',
            BACK_HINT,
          ].join('\n'),
        };
      }

      if (details.error) {
        return {
          mode: 'text',
          content: [
            buildHeaderLine(config.title, ''),
            '',
            pxTruncate(details.error, TEXT_INNER_W),
            '',
            BACK_HINT,
          ].join('\n'),
        };
      }

      const lines: string[] = [buildHeaderLine(config.title, '')];
      for (const field of details.fields) {
        lines.push('', field.label, field.value);
      }
      lines.push('', BACK_HINT);
      return { mode: 'text', content: lines.join('\n') };
    },

    action(action, state, ctx) {
      if (action.type === 'GO_BACK') {
        ctx.stopSpinner();
        const parent = typeof config.parent === 'function' ? config.parent(state) : config.parent;
        ctx.navigate(parent);
        return;
      }

      // SELECT_HIGHLIGHTED / LONG_PRESS / HIGHLIGHT_MOVE: the text container scrolls overflow.
    },
  };
}
