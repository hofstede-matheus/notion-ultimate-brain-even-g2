import { describe, expect, it } from 'vitest';
import {
  REACT_PROD_ERROR_URL,
  stripReactProdErrorUrls,
  stripReactProdErrorUrlsFromBundle,
} from '../../build/strip-react-error-urls';

/** Same shape Even Hub review uses: a substring sweep over packed JS. */
const EVENHUB_URL_SCAN = /(?:https?|wss?):\/\/[^"'`\\ \n]*/g;

function scannedUrls(source: string): string[] {
  return [...source.matchAll(EVENHUB_URL_SCAN)].map((m) => m[0]);
}

describe('stripReactProdErrorUrls', () => {
  it('removes the production error-decoder URL so the store scan cannot see it', () => {
    // Minified react-dom: `visit https://react.dev/errors/` + code
    const packed = `throw Error("Minified React error #"+n+"; visit ${REACT_PROD_ERROR_URL}"+n+" for the full message")`;

    const stripped = stripReactProdErrorUrls(packed);

    expect(scannedUrls(stripped)).not.toContain(REACT_PROD_ERROR_URL);
    expect(stripped).not.toContain('react.dev');
  });

  it('leaves the URLs this app actually opens', () => {
    const packed = [
      'fetch("https://bfh6yxf7bgbddlc2bijzj5jygq0ouoyc.lambda-url.us-east-1.on.aws/api/tasks")',
      'fetch("https://notion-ub-assets.web.app/vosk/model.tar.gz")',
      'new WebSocket("wss://stt-rt.soniox.com/transcribe-websocket")',
      `throw Error("${REACT_PROD_ERROR_URL}"+n)`,
    ].join('\n');

    expect(scannedUrls(stripReactProdErrorUrls(packed))).toEqual([
      'https://bfh6yxf7bgbddlc2bijzj5jygq0ouoyc.lambda-url.us-east-1.on.aws/api/tasks',
      'https://notion-ub-assets.web.app/vosk/model.tar.gz',
      'wss://stt-rt.soniox.com/transcribe-websocket',
    ]);
  });

  it('strips every occurrence', () => {
    const packed = `${REACT_PROD_ERROR_URL}1 ${REACT_PROD_ERROR_URL}2`;
    expect(stripReactProdErrorUrls(packed)).toBe('1 2');
  });
});

describe('stripReactProdErrorUrlsFromBundle', () => {
  it('rewrites JS chunks and string assets, not binary assets', () => {
    const png = new Uint8Array([1, 2, 3]);
    const bundle = {
      'index.js': {
        type: 'chunk',
        code: `visit ${REACT_PROD_ERROR_URL}"+n`,
      },
      'index.html': {
        type: 'asset',
        source: `<script>visit ${REACT_PROD_ERROR_URL}</script>`,
      },
      'icon.png': { type: 'asset', source: png },
    };

    stripReactProdErrorUrlsFromBundle(bundle);

    expect(bundle['index.js'].code).not.toContain('react.dev');
    expect(bundle['index.html'].source).not.toContain('react.dev');
    expect(bundle['icon.png'].source).toBe(png);
  });
});
