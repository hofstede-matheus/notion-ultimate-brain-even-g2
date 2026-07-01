/**
 * Fetch + repackage the offline Vosk speech model for voice task entry.
 *
 * vosk-browser loads a gzipped tar of a `model/` folder. The official Portuguese
 * small model ships as a zip with a versioned top folder, so we download it,
 * rename the top folder to `model/`, and write public/vosk/model.tar.gz.
 *
 * Adapted directly from EvenChess scripts/fetch-vosk-model.cjs.
 *
 * Run once before building:
 *   npm run fetch:voice-model
 *
 * The model (~50 MB) is NOT committed to git. Vite copies public/ into dist/,
 * so it gets packed into the .ehpk and served locally — fully offline at runtime.
 * If the file is absent the app shows an error on the Add Task screen.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

// English small model (~40 MB) — same one used by EvenChess
const MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip';
const OUT_DIR = path.join(__dirname, '..', 'public', 'vosk');
const OUT_FILE = path.join(OUT_DIR, 'model.tar.gz');

if (fs.existsSync(OUT_FILE)) {
  console.log('[fetch-vosk-model] public/vosk/model.tar.gz already exists — skipping.');
  process.exit(0);
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(download(res.headers.location, dest, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vosk-pt-'));
  const zipPath = path.join(tmp, 'model.zip');
  try {
    console.log('[fetch-vosk-model] downloading Portuguese model from:');
    console.log(' ', MODEL_URL);
    await download(MODEL_URL, zipPath);

    console.log('[fetch-vosk-model] extracting…');
    execFileSync('unzip', ['-q', zipPath, '-d', tmp], { stdio: 'inherit' });

    // Find the extracted top-level folder (versioned name like vosk-model-small-pt-0.3)
    const top = fs
      .readdirSync(tmp, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)[0];
    if (!top) throw new Error('no model folder found in archive');

    // Rename to plain `model/` — the name vosk-browser expects
    fs.renameSync(path.join(tmp, top), path.join(tmp, 'model'));

    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log('[fetch-vosk-model] packaging public/vosk/model.tar.gz…');
    execFileSync('tar', ['-czf', OUT_FILE, '-C', tmp, 'model'], { stdio: 'inherit' });

    const mb = (fs.statSync(OUT_FILE).size / 1e6).toFixed(1);
    console.log(`[fetch-vosk-model] done — ${mb} MB written to public/vosk/model.tar.gz`);
  } catch (err) {
    console.error('[fetch-vosk-model] FAILED:', err.message);
    console.error('Add Task voice input will not work until this succeeds.');
    process.exitCode = 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
