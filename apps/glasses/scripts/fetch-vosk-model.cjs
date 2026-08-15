/**
 * Fetch + repackage the offline Vosk speech model for voice task entry.
 *
 * This is a *publishing* step, not a build step. The model is no longer packed
 * into the .ehpk (it was 39 MB of a 45 MB bundle, against a ~10 MB practical
 * cap); it is hosted and downloaded on demand from the app's Settings screen —
 * see ../src/voice-model.ts and .github/workflows/deploy-voice-model.yml.
 *
 * vosk-browser loads a gzipped tar of a `model/` folder. Vosk's small models
 * ship as a zip with a versioned top folder, so we download it, rename the
 * top folder to `model/`, and write dist-model/vosk/model.tar.gz — the layout
 * the `notion-ub-assets` Firebase Hosting site serves, so the deployed path
 * matches VOICE_MODEL_URL in ../src/glasses/constants.ts.
 *
 * Adapted directly from EvenChess scripts/fetch-vosk-model.cjs.
 *
 * Run before deploying the model (defaults to English):
 *   pnpm --filter @notion-ub/glasses fetch:voice-model
 *
 * Publish a different language:
 *   node scripts/fetch-vosk-model.cjs fr        # key from LANGUAGES below
 *   node scripts/fetch-vosk-model.cjs --list     # print supported keys
 *   node scripts/fetch-vosk-model.cjs https://…  # any Vosk model .zip URL
 *
 * The model (~30-100 MB depending on language) is NOT committed to git. Only
 * `en` is published today; the client fetches a single fixed URL.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { execFileSync } = require('node:child_process');

// Vosk "small" model catalog — https://alphacephei.com/vosk/models
// Filenames don't follow a predictable lang -> URL pattern (versions/suffixes
// differ per language), so this is a lookup table rather than a template.
const LANGUAGES = {
  en: {
    label: 'English',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
  },
  'en-in': {
    label: 'Indian English',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip',
  },
  cn: { label: 'Chinese', url: 'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip' },
  ru: { label: 'Russian', url: 'https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip' },
  fr: { label: 'French', url: 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip' },
  de: { label: 'German', url: 'https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip' },
  es: { label: 'Spanish', url: 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip' },
  pt: {
    label: 'Portuguese',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip',
  },
  tr: { label: 'Turkish', url: 'https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip' },
  vn: {
    label: 'Vietnamese',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-vn-0.4.zip',
  },
  it: { label: 'Italian', url: 'https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip' },
  nl: { label: 'Dutch', url: 'https://alphacephei.com/vosk/models/vosk-model-small-nl-0.22.zip' },
  ca: { label: 'Catalan', url: 'https://alphacephei.com/vosk/models/vosk-model-small-ca-0.4.zip' },
  fa: { label: 'Farsi', url: 'https://alphacephei.com/vosk/models/vosk-model-small-fa-0.42.zip' },
  ja: {
    label: 'Japanese',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip',
  },
  eo: {
    label: 'Esperanto',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-eo-0.42.zip',
  },
  hi: { label: 'Hindi', url: 'https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip' },
  cs: {
    label: 'Czech',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-cs-0.4-rhasspy.zip',
  },
  pl: { label: 'Polish', url: 'https://alphacephei.com/vosk/models/vosk-model-small-pl-0.22.zip' },
  uz: { label: 'Uzbek', url: 'https://alphacephei.com/vosk/models/vosk-model-small-uz-0.22.zip' },
  ko: { label: 'Korean', url: 'https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip' },
  gu: {
    label: 'Gujarati',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-gu-0.42.zip',
  },
  tg: { label: 'Tajik', url: 'https://alphacephei.com/vosk/models/vosk-model-small-tg-0.22.zip' },
  te: { label: 'Telugu', url: 'https://alphacephei.com/vosk/models/vosk-model-small-te-0.42.zip' },
  ky: { label: 'Kyrgyz', url: 'https://alphacephei.com/vosk/models/vosk-model-small-ky-0.42.zip' },
  ka: {
    label: 'Georgian',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-ka-0.42.zip',
  },
};

const OUT_DIR = path.join(__dirname, '..', 'dist-model', 'vosk');
const OUT_FILE = path.join(OUT_DIR, 'model.tar.gz');
const OUT_LABEL = 'dist-model/vosk/model.tar.gz';

function printLanguages() {
  console.log('[fetch-vosk-model] supported language keys:');
  for (const [key, { label }] of Object.entries(LANGUAGES)) {
    console.log(`  ${key.padEnd(6)} ${label}`);
  }
  console.log(
    '\nOr pass any Vosk model .zip URL directly — see https://alphacephei.com/vosk/models',
  );
}

const arg = process.argv[2];

if (arg === '--list' || arg === '-l') {
  printLanguages();
  process.exit(0);
}

let MODEL_URL;
if (!arg) {
  MODEL_URL = LANGUAGES.en.url;
} else if (arg.startsWith('http://') || arg.startsWith('https://')) {
  MODEL_URL = arg;
} else if (LANGUAGES[arg]) {
  MODEL_URL = LANGUAGES[arg].url;
} else {
  console.error(`[fetch-vosk-model] unknown language "${arg}".`);
  printLanguages();
  process.exit(1);
}

if (fs.existsSync(OUT_FILE)) {
  console.log(`[fetch-vosk-model] ${OUT_LABEL} already exists — skipping.`);
  console.log('[fetch-vosk-model] to switch languages, delete that file first and re-run.');
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vosk-model-'));
  const zipPath = path.join(tmp, 'model.zip');
  try {
    console.log('[fetch-vosk-model] downloading model from:');
    console.log(' ', MODEL_URL);
    await download(MODEL_URL, zipPath);

    console.log('[fetch-vosk-model] extracting…');
    execFileSync('unzip', ['-q', zipPath, '-d', tmp], { stdio: 'inherit' });

    // Find the extracted top-level folder (versioned name like vosk-model-small-en-us-0.15)
    const top = fs
      .readdirSync(tmp, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)[0];
    if (!top) throw new Error('no model folder found in archive');

    // Rename to plain `model/` — the name vosk-browser expects
    fs.renameSync(path.join(tmp, top), path.join(tmp, 'model'));

    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log(`[fetch-vosk-model] packaging ${OUT_LABEL}…`);
    execFileSync('tar', ['-czf', OUT_FILE, '-C', tmp, 'model'], { stdio: 'inherit' });

    const mb = (fs.statSync(OUT_FILE).size / 1e6).toFixed(1);
    console.log(`[fetch-vosk-model] done — ${mb} MB written to ${OUT_LABEL}`);
    console.log('[fetch-vosk-model] deploy it with the "Deploy voice model" workflow.');
  } catch (err) {
    console.error('[fetch-vosk-model] FAILED:', err.message);
    console.error('The offline voice model will not be downloadable until this succeeds.');
    process.exitCode = 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
