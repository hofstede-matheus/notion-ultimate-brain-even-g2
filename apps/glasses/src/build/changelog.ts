/**
 * Turns the newest release section of release-please's CHANGELOG.md into the
 * phone status screen's "What's new" card (see web/whats-new.ts). Runs at
 * build time from vite.config.ts and is baked in as `__RELEASE_NOTES__`, so
 * the card always matches the release body with no hand-written copy.
 *
 * Bullets are reduced to plain text: Even Hub review scans the packed JS for
 * URL literals and diffs them against app.json's `network.whitelist` (see
 * strip-react-error-urls.ts), so no GitHub link may survive into the bundle.
 */

export interface ReleaseNotesGroup {
  /** The `### …` heading release-please writes, e.g. "Features", "Bug Fixes". */
  heading: string;
  bullets: string[];
}

export interface ReleaseNotes {
  version: string;
  groups: ReleaseNotesGroup[];
}

/** `## [2.11.0](https://…compare…) (2026-08-30)` or the link-less `## 2.11.0 (2026-08-30)`. */
const RELEASE_HEADING = /^## \[?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?/;
const GROUP_HEADING = /^### (.+)$/;
const BULLET = /^[*-] (.*)$/;
/** One trailing ` ([#57](url))` / ` ([c479874](url))` reference group. */
const TRAILING_REF = /\s*\(\[[^\]]*\]\([^)]*\)\)\s*$/;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const BARE_URL = /\b(?:https?|wss?):\/\/\S+/g;

/** `**notes:** make … ([#57](…)) ([c479874](…))` → `notes: make …`. */
export function cleanBullet(raw: string): string {
  let text = raw.trim();
  while (TRAILING_REF.test(text)) text = text.replace(TRAILING_REF, '');
  return text
    .replace(MARKDOWN_LINK, '$1')
    .replace(BARE_URL, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The newest `## x.y.z` section, or `null` when the file has none. */
export function parseLatestRelease(markdown: string): ReleaseNotes | null {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => RELEASE_HEADING.test(line));
  if (start === -1) return null;
  const version = RELEASE_HEADING.exec(lines[start] ?? '')?.[1];
  if (!version) return null;

  const groups: ReleaseNotesGroup[] = [];
  let group: ReleaseNotesGroup | null = null;
  // Raw text of the bullet being read — release-please wraps long entries
  // (e.g. BREAKING CHANGE notes) onto indented continuation lines.
  let pending: string | null = null;

  const flush = (): void => {
    if (pending !== null && group) {
      const text = cleanBullet(pending);
      if (text) group.bullets.push(text);
    }
    pending = null;
  };

  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    const heading = GROUP_HEADING.exec(line);
    if (heading) {
      flush();
      group = { heading: (heading[1] ?? '').trim(), bullets: [] };
      groups.push(group);
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      pending = bullet[1] ?? '';
      continue;
    }
    if (pending !== null && /^\s+\S/.test(line)) {
      pending += ` ${line.trim()}`;
      continue;
    }
    flush();
  }
  flush();

  return { version, groups: groups.filter((g) => g.bullets.length > 0) };
}

/**
 * Why `notes` can't be shipped for `pkgVersion`, or `null` when they can.
 * The production build fails on a non-null result so a release-please format
 * change can't silently empty or mislabel the card.
 */
export function releaseNotesProblem(notes: ReleaseNotes | null, pkgVersion: string): string | null {
  if (!notes) return 'CHANGELOG.md has no "## x.y.z" release section';
  if (notes.version !== pkgVersion) {
    return `CHANGELOG.md's newest section is ${notes.version} but package.json is ${pkgVersion}`;
  }
  if (notes.groups.length === 0) return `CHANGELOG.md's ${notes.version} section has no bullets`;
  return null;
}
