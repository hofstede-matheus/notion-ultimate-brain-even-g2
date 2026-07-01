# Offline voice model

Add Task voice input uses [vosk-browser](https://github.com/ccoreilly/vosk-browser),
which runs a small Kaldi speech model entirely on-device — no server, no API key, no network.

The model is **not committed** (~50 MB). Fetch + repackage it once before building:

```
npm run fetch:voice-model
```

This downloads `vosk-model-small-en-us-0.15` (English, ~40 MB), renames its top folder
to `model/`, and writes `public/vosk/model.tar.gz` — the format vosk-browser expects.

Vite copies `public/` into `dist/`, so the model is packed into the `.ehpk` and served
from the relative URL `/vosk/model.tar.gz` — **fully offline** once installed on the phone.

The model is preloaded in the background at app startup (`preloadVoskModel` in `app.ts`),
so by the time the user navigates to Add Task it should already be warm.
