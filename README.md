# Wedding Invitation - Full Photo Sync Setup

This project now supports:

- Cross-device photo uploads via Firebase Storage
- Optional auto-forwarding of each uploaded photo to Google Photos through a secure backend webhook
- Optional direct upload of each photo to a Google Drive folder link

## Quickest option: Direct to your Drive (no Node backend)

If OAuth + backend setup feels difficult, use Google Apps Script as your Drive upload endpoint.

1. Open https://script.google.com and create a new script project.
2. Copy content from [google-drive-direct-upload.gs](google-drive-direct-upload.gs) into Apps Script editor.
3. In script CONFIG, set:
  - `DRIVE_FOLDER_LINK` or `DRIVE_FOLDER_ID`
  - `WEBHOOK_SECRET`
4. Deploy:
  - `Deploy` -> `New deployment` -> type `Web app`
  - `Execute as`: `Me`
  - `Who has access`: `Anyone with the link`
5. Copy the Web App URL.
6. In local/frontend env set:
  - `VITE_PHOTO_SYNC_WEBHOOK_URL=<your-web-app-url>?secret=<WEBHOOK_SECRET>`
  - `VITE_PHOTO_SYNC_WEBHOOK_SECRET=` (leave empty for Apps Script mode)
7. Run or redeploy frontend.

Now every photo upload goes to your Drive folder through that Apps Script URL.

## 1. Frontend setup

Create a `.env` file (or use your deployment environment variables) with:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_PHOTO_SYNC_WEBHOOK_URL` (optional but required for Google Photos sync)
- `VITE_PHOTO_SYNC_WEBHOOK_SECRET` (should match backend secret)

## 2. Google Cloud + Photos API setup

1. Create/select a Google Cloud project.
2. Enable `Photos Library API`.
3. Configure OAuth consent screen (testing is fine for personal use).
4. Create OAuth client credentials (Web application).
5. Add redirect URI (for local token generation, for example `http://localhost:3000/oauth2callback`).

Set backend environment values:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `ENABLE_GOOGLE_PHOTOS_SYNC=true`
- `ENABLE_GOOGLE_DRIVE_SYNC=true`

Generate refresh token:

```bash
npm run google-token
```

Copy output token into:

- `GOOGLE_OAUTH_REFRESH_TOKEN`

Optional:

- `GOOGLE_PHOTOS_ALBUM_ID` to push all uploads into one album.
- `GOOGLE_DRIVE_FOLDER_ID` for direct Drive folder upload.
- `GOOGLE_DRIVE_FOLDER_LINK` as an alternative to folder id (the server extracts id from the link).

If you only want Google Drive uploads (no Photos), set:

- `ENABLE_GOOGLE_PHOTOS_SYNC=false`
- `ENABLE_GOOGLE_DRIVE_SYNC=true`

## 3. Run backend sync server locally

```bash
npm run sync-server
```

The webhook endpoint is:

- `POST /api/google-photos-sync`
- `POST /api/photo-sync` (alias, same behavior)

Health endpoint:

- `GET /health`

## 4. Run frontend locally

```bash
npm run dev
```

## 5. Deploy backend (Render or Railway)

### Render

- `render.yaml` is included.
- Create a new Web Service from this repo.
- Set secrets in Render dashboard:
  - `PHOTO_SYNC_WEBHOOK_SECRET`
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REDIRECT_URI`
  - `GOOGLE_OAUTH_REFRESH_TOKEN`
  - `GOOGLE_PHOTOS_ALBUM_ID` (optional)

### Railway

- `railway.json` is included.
- Deploy this repo and set the same backend environment variables.

## 6. Point frontend webhook to deployed backend

Set:

- `VITE_PHOTO_SYNC_WEBHOOK_URL=https://<your-backend-domain>/api/google-photos-sync`
- `VITE_PHOTO_SYNC_WEBHOOK_SECRET=<same secret as backend>`

Rebuild/redeploy frontend after changing env vars.

## Security notes

- Never put Google OAuth client secrets or refresh tokens in frontend env (`VITE_*`).
- Keep secrets only on backend hosting platform.
- Restrict `PHOTO_SYNC_ALLOWED_ORIGINS` to your real frontend domains.
