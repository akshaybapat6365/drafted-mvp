# Firebase-Native Deployment Runbook

## Components

- Firebase Hosting: serves `web/` Next.js app
- Cloud Functions (2nd gen): `functions/src/index.ts`
  - `api` HTTP function (`/api/v1/**`)
  - `onJobCreated` Firestore trigger worker
- Firestore: sessions/jobs/artifacts metadata
- Cloud Storage: artifact and export object storage
- Firebase Auth: Google + email/password

## Required environment

Set these for Functions runtime:

- `GEMINI_API_KEY`
- `GEMINI_BASE_URL` (optional, defaults to Google API v1beta endpoint)
- `GEMINI_TEXT_MODEL` (default `gemini-2.5-flash`)
- `GEMINI_IMAGE_MODEL_PREVIEW` (default `gemini-3-pro-image-preview`)
- `JOB_MAX_RETRIES` (default `2`)
- `GCS_BUCKET` (optional if default Firebase bucket is used)

For web app (client-side Firebase config):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Deploy

```bash
cd /Users/akshaybapat/drafted-mvp/functions
npm install
npm run build

cd /Users/akshaybapat/drafted-mvp/web
npm install

cd /Users/akshaybapat/drafted-mvp
firebase deploy --only functions,hosting,firestore,storage
```

## Post-deploy checks

1. `GET /api/v1/system/health` returns:
   - `ok: true`
   - `provider_mode: gemini` when key is set, else `mock`
2. Sign in through `/login` (Google or email/password).
3. Create a draft from `/app/drafts/new`.
4. Verify job transitions `queued -> running -> succeeded`.
5. Confirm artifacts list and signed download URLs work.
6. Export endpoint returns downloadable zip.
