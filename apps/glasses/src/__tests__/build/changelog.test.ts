/**
 * build/changelog.ts — the parser that turns CHANGELOG.md's newest section into the status
 * screen's "What's new" card at build time. Runs against the real CHANGELOG.md (invariants
 * only, since its content changes every release) and against synthetic release-please output.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cleanBullet, parseLatestRelease, releaseNotesProblem } from '../../build/changelog';

const REPO = 'https://github.com/hofstede-matheus/notion-ultimate-brain-even-g2';

const realChangelog = readFileSync(
  fileURLToPath(new URL('../../../CHANGELOG.md', import.meta.url)),
  'utf-8',
);
const pkgVersion: string = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf-8'),
).version;

/** Same shape Even Hub review uses: a substring sweep over packed JS. */
const EVENHUB_URL_SCAN = /(?:https?|wss?):\/\/[^"'`\\ \n]*/g;

const TWO_RELEASES = `# Changelog

## [2.11.0](${REPO}/compare/glasses-v2.10.0...glasses-v2.11.0) (2026-08-30)


### Features

* **glasses:** add hold to mark as done action ([#46](${REPO}/issues/46)) ([56a6804](${REPO}/commit/56a6804b79301572bc8826d23ae9ffe1410eb38e))


### Bug Fixes

* **glasses:** update what's new entry ([#48](${REPO}/issues/48)) ([b6b54cf](${REPO}/commit/b6b54cf1855698ac0cea81b3e907393ca08715d3))

## [2.10.0](${REPO}/compare/glasses-v2.9.0...glasses-v2.10.0) (2026-08-30)


### Features

* **glasses:** add contextual menu for tasks and notes ([#44](${REPO}/issues/44)) ([f8b0c07](${REPO}/commit/f8b0c07))
`;

describe('parseLatestRelease — the real CHANGELOG.md', () => {
  const notes = parseLatestRelease(realChangelog);

  it('finds a newest section that matches package.json, so a production build would ship', () => {
    expect(notes?.version).toBe(pkgVersion);
    expect(releaseNotesProblem(notes, pkgVersion)).toBeNull();
  });

  it('leaves no URL, markdown link or bold marker in what gets baked into the bundle', () => {
    const baked = JSON.stringify(notes);
    expect(baked.match(EVENHUB_URL_SCAN)).toBeNull();
    expect(baked).not.toContain('](');
    expect(baked).not.toContain('**');
  });
});

describe('parseLatestRelease — synthetic release-please output', () => {
  it('takes the newest section only, grouped by ### heading, with clean bullets', () => {
    expect(parseLatestRelease(TWO_RELEASES)).toEqual({
      version: '2.11.0',
      groups: [
        { heading: 'Features', bullets: ['glasses: add hold to mark as done action'] },
        { heading: 'Bug Fixes', bullets: ["glasses: update what's new entry"] },
      ],
    });
  });

  it('reads a Features-only section', () => {
    const md = `## [3.0.0](${REPO}/compare/a...b) (2026-12-01)\n\n### Features\n\n* **tasks:** one ([#1](${REPO}/issues/1)) ([abc1234](${REPO}/commit/abc1234))\n* **notes:** two ([#2](${REPO}/issues/2)) ([def5678](${REPO}/commit/def5678))\n`;
    expect(parseLatestRelease(md)).toEqual({
      version: '3.0.0',
      groups: [{ heading: 'Features', bullets: ['tasks: one', 'notes: two'] }],
    });
  });

  it('reads a Bug Fixes-only section with an unscoped bullet', () => {
    const md = `## [2.8.1](${REPO}/compare/a...b) (2026-08-17)\n\n\n### Bug Fixes\n\n* better feedback when wrong api key ([#28](${REPO}/issues/28)) ([d47ffaa](${REPO}/commit/d47ffaa))\n`;
    expect(parseLatestRelease(md)).toEqual({
      version: '2.8.1',
      groups: [{ heading: 'Bug Fixes', bullets: ['better feedback when wrong api key'] }],
    });
  });

  it('reads a link-less "## x.y.z (date)" heading', () => {
    const md = '## 1.0.0 (2026-01-01)\n\n### Features\n\n* first\n';
    expect(parseLatestRelease(md)?.version).toBe('1.0.0');
  });

  it('joins an indented continuation line onto its bullet', () => {
    const md =
      '## [4.0.0](x) (2026-12-01)\n\n### ⚠ BREAKING CHANGES\n\n* **server:** the config header\n  is now required\n\n### Features\n\n* later\n';
    expect(parseLatestRelease(md)?.groups).toEqual([
      { heading: '⚠ BREAKING CHANGES', bullets: ['server: the config header is now required'] },
      { heading: 'Features', bullets: ['later'] },
    ]);
  });

  it('drops a heading with no bullets under it', () => {
    const md = '## [1.2.3](x) (2026-12-01)\n\n### Features\n\n### Bug Fixes\n\n* fixed\n';
    expect(parseLatestRelease(md)?.groups).toEqual([{ heading: 'Bug Fixes', bullets: ['fixed'] }]);
  });

  it('returns null when there is no release section', () => {
    expect(parseLatestRelease('# Changelog\n\nNothing yet.\n')).toBeNull();
    expect(parseLatestRelease('')).toBeNull();
  });
});

describe('cleanBullet', () => {
  it('strips the trailing issue and commit reference groups and unwraps the bold scope', () => {
    expect(
      cleanBullet(
        `**notes:** make Content relation optional for stock Ultimate Brain ([#57](${REPO}/issues/57)) ([c479874](${REPO}/commit/c479874))`,
      ),
    ).toBe('notes: make Content relation optional for stock Ultimate Brain');
  });

  it('turns any other markdown link into its text and removes bare URLs', () => {
    expect(cleanBullet(`see [the docs](${REPO}/docs) or ${REPO} now`)).toBe('see the docs or now');
  });
});

describe('releaseNotesProblem', () => {
  const notes = { version: '2.11.0', groups: [{ heading: 'Features', bullets: ['x'] }] };

  it('is null when the notes match the package version', () => {
    expect(releaseNotesProblem(notes, '2.11.0')).toBeNull();
  });

  it('flags a missing section', () => {
    expect(releaseNotesProblem(null, '2.11.0')).toMatch(/no "## x.y.z" release section/);
  });

  it('flags a version mismatch, naming both versions', () => {
    expect(releaseNotesProblem(notes, '2.12.0')).toBe(
      "CHANGELOG.md's newest section is 2.11.0 but package.json is 2.12.0",
    );
  });

  it('flags a section with no bullets', () => {
    expect(releaseNotesProblem({ version: '2.11.0', groups: [] }, '2.11.0')).toMatch(/no bullets/);
  });
});
