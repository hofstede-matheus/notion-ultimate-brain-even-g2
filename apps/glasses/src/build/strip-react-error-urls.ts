/**
 * Even Hub review scans packed JS for URL literals and diffs them against
 * app.json `network.whitelist`. Production React embeds this URL in minified
 * invariant messages (`formatProdErrorMessage`) — concatenated into
 * `Error.message`, never fetched. Strip it so the .ehpk only contains URLs
 * the app actually opens.
 */
export const REACT_PROD_ERROR_URL = 'https://react.dev/errors/';

export function stripReactProdErrorUrls(source: string): string {
  return source.replaceAll(REACT_PROD_ERROR_URL, '');
}

/** Rewrite JS chunks (and string assets) in a Rollup/Vite output bundle. */
export function stripReactProdErrorUrlsFromBundle(
  bundle: Record<string, { type: string; code?: string; source?: string | Uint8Array }>,
): void {
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk' && typeof item.code === 'string') {
      item.code = stripReactProdErrorUrls(item.code);
    } else if (typeof item.source === 'string') {
      item.source = stripReactProdErrorUrls(item.source);
    }
  }
}
