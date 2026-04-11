const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { google } = require("googleapis");

dotenv.config();

const app = express();
const port = Number(process.env.PHOTO_SYNC_SERVER_PORT || 8787);

const allowedOrigins = (process.env.PHOTO_SYNC_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed."));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

function assertEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function sanitizeFileName(name) {
  return (name || "wedding-photo")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");
}

function createOAuthClient() {
  const clientId = assertEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = assertEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = assertEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const refreshToken = assertEnv("GOOGLE_OAUTH_REFRESH_TOKEN");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return oauth2Client;
}

async function getAccessToken(oauth2Client) {
  const tokenResponse = await oauth2Client.getAccessToken();

  if (!tokenResponse?.token) {
    throw new Error("Unable to fetch Google OAuth access token.");
  }

  return tokenResponse.token;
}

async function uploadFromUrlToGooglePhotos({ downloadUrl, fileName, description }) {
  const oauth2Client = createOAuthClient();
  const accessToken = await getAccessToken(oauth2Client);

  const fileResponse = await fetch(downloadUrl);

  if (!fileResponse.ok) {
    throw new Error(`Unable to download uploaded photo: ${fileResponse.status}`);
  }

  const binary = Buffer.from(await fileResponse.arrayBuffer());
  const safeFileName = `${sanitizeFileName(fileName).replace(/\.[^.]+$/, "") || "wedding-photo"}.jpg`;

  const uploadTokenResponse = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-type": "application/octet-stream",
      "X-Goog-Upload-Content-Type": "image/jpeg",
      "X-Goog-Upload-File-Name": safeFileName,
      "X-Goog-Upload-Protocol": "raw",
    },
    body: binary,
  });

  if (!uploadTokenResponse.ok) {
    const errorText = await uploadTokenResponse.text();
    throw new Error(`Google upload token request failed: ${uploadTokenResponse.status} ${errorText}`);
  }

  const uploadToken = await uploadTokenResponse.text();
  const albumId = process.env.GOOGLE_PHOTOS_ALBUM_ID || "";

  const payload = {
    newMediaItems: [
      {
        description,
        simpleMediaItem: {
          uploadToken,
          fileName: safeFileName,
        },
      },
    ],
  };

  if (albumId) {
    payload.albumId = albumId;
  }

  const createResponse = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Google media create failed: ${createResponse.status} ${errorText}`);
  }

  const result = await createResponse.json();
  const itemResult = result?.newMediaItemResults?.[0];

  if (!itemResult || itemResult.status?.message) {
    const message = itemResult?.status?.message || "Unknown Google Photos create error.";
    throw new Error(message);
  }

  return {
    productUrl: itemResult.mediaItem?.productUrl,
    mediaItemId: itemResult.mediaItem?.id,
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "google-photos-sync" });
});

app.post("/api/google-photos-sync", async (req, res) => {
  try {
    const sharedSecret = process.env.PHOTO_SYNC_WEBHOOK_SECRET || "";

    if (sharedSecret) {
      const providedSecret = req.get("x-sync-secret") || "";

      if (providedSecret !== sharedSecret) {
        res.status(401).json({ ok: false, message: "Invalid webhook secret." });
        return;
      }
    }

    const photo = req.body?.photo;

    if (!photo?.downloadUrl && !photo?.url) {
      res.status(400).json({ ok: false, message: "Missing photo URL in payload." });
      return;
    }

    const downloadUrl = photo.downloadUrl || photo.url;
    const name = photo.name || "wedding-photo.jpg";
    const createdAt = photo.createdAt || new Date().toISOString();

    const uploaded = await uploadFromUrlToGooglePhotos({
      downloadUrl,
      fileName: name,
      description: `Wedding upload ${createdAt}`,
    });

    res.json({
      ok: true,
      uploaded,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unknown sync failure.",
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Google Photos sync server listening on http://0.0.0.0:${port}`);
});
