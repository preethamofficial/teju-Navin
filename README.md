# Wedding Invitation - Full Photo Sync Setup

This project now supports:

- Cross-device photo uploads via Firebase Storage
- Optional auto-forwarding of each uploaded photo to Google Photos through a secure backend webhook

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

Generate refresh token:

```bash
npm run google-token
```

Copy output token into:

- `GOOGLE_OAUTH_REFRESH_TOKEN`

Optional:

- `GOOGLE_PHOTOS_ALBUM_ID` to push all uploads into one album.

## 3. Run backend sync server locally

```bash
npm run sync-server
```

The webhook endpoint is:

- `POST /api/google-photos-sync`

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
