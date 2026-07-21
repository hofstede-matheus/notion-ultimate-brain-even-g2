/**
 * Raw PCM audio frames arrive continuously during voice recording, and the
 * host bridge logs every one (`… EvenHub event: {jsonData:{audioPcm:[…]}}`),
 * flooding the console/terminal with number arrays. Drop those lines entirely
 * — they carry no diagnostic value. Cheap property checks only; never
 * stringifies large payloads.
 */
export function isAudioFrameLog(args: unknown[]): boolean {
  for (const a of args) {
    if (typeof a === 'string') {
      if (a.includes('audioPcm')) return true;
    } else if (a && typeof a === 'object') {
      const o = a as Record<string, unknown>;
      const jsonData = o.jsonData as Record<string, unknown> | undefined;
      if (o.audioPcm != null || jsonData?.audioPcm != null) return true;
    }
  }
  return false;
}
