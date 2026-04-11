const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { google } = require("googleapis");
const { Readable } = require("stream");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || process.env.PHOTO_SYNC_SERVER_PORT || 8787);

const allowedOrigins = (process.env.PHOTO_SYNC_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed."));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "wedding-photo-sync",
    routes: ["GET /health", "POST /api/google-photos-sync", "POST /api/photo-sync"],
  });
});

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

function isEnabled(name, defaultValue = true) {
  const raw = (process.env[name] || "").trim().toLowerCase();

  if (!raw) {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(raw);
}

function parseDriveFolderId(input) {
  const value = (input || "").trim();

  if (!value) {
    return "";
  }

  // If the value is already a folder id, use it directly.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(value) && !value.includes("/")) {
    return value;
  }

  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) {
    return folderMatch[1];
  }

  const idMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) {
    return idMatch[1];
  }

  return "";
}

function getDriveFolderId() {
  return (
    parseDriveFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID) ||
    parseDriveFolderId(process.env.GOOGLE_DRIVE_FOLDER_LINK)
  );
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

async function downloadPhotoBuffer(downloadUrl) {
  const fileResponse = await fetch(downloadUrl);

  if (!fileResponse.ok) {
    throw new Error(`Unable to download uploaded photo: ${fileResponse.status}`);
  }

  const mimeType = fileResponse.headers.get("content-type") || "image/jpeg";
  const binary = Buffer.from(await fileResponse.arrayBuffer());

  return {
    binary,
    mimeType,
  };
}

function buildSafePhotoName(fileName, fallbackExtension = "jpg") {
  const base = sanitizeFileName(fileName);
  const hasExtension = /\.[a-z0-9]+$/i.test(base);

  if (hasExtension) {
    return base;
  }

  return `${base || "wedding-photo"}.${fallbackExtension}`;
}

async function uploadFromUrlToGooglePhotos({ downloadUrl, fileName, description }) {
  const oauth2Client = createOAuthClient();
  const accessToken = await getAccessToken(oauth2Client);
  const { binary } = await downloadPhotoBuffer(downloadUrl);
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

async function uploadFromUrlToGoogleDrive({ downloadUrl, fileName }) {
  const folderId = getDriveFolderId();

  if (!folderId) {
    throw new Error("Google Drive folder id/link is missing. Set GOOGLE_DRIVE_FOLDER_ID or GOOGLE_DRIVE_FOLDER_LINK.");
  }

  const oauth2Client = createOAuthClient();
  const { binary, mimeType } = await downloadPhotoBuffer(downloadUrl);
  const extension = mimeType.includes("png") ? "png" : "jpg";
  const safeFileName = buildSafePhotoName(fileName, extension);

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const response = await drive.files.create({
    requestBody: {
      name: safeFileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(binary),
    },
    fields: "id,name,webViewLink,webContentLink,parents",
    supportsAllDrives: true,
  });

  return {
    fileId: response.data.id,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
  };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "wedding-photo-sync",
    googlePhotosEnabled: isEnabled("ENABLE_GOOGLE_PHOTOS_SYNC", true),
    googleDriveEnabled: isEnabled("ENABLE_GOOGLE_DRIVE_SYNC", true),
    hasDriveFolder: Boolean(getDriveFolderId()),
  });
});

async function handlePhotoSync(req, res) {
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

    const enablePhotosSync = isEnabled("ENABLE_GOOGLE_PHOTOS_SYNC", true);
    const enableDriveSync = isEnabled("ENABLE_GOOGLE_DRIVE_SYNC", true);

    if (!enablePhotosSync && !enableDriveSync) {
      res.status(400).json({
        ok: false,
        message: "Both sync targets are disabled. Enable Google Photos and/or Google Drive sync.",
      });
      return;
    }

    const uploaded = {};

    if (enablePhotosSync) {
      uploaded.googlePhotos = await uploadFromUrlToGooglePhotos({
        downloadUrl,
        fileName: name,
        description: `Wedding upload ${createdAt}`,
      });
    }

    if (enableDriveSync) {
      uploaded.googleDrive = await uploadFromUrlToGoogleDrive({
        downloadUrl,
        fileName: name,
      });
    }

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
}

app.post("/api/google-photos-sync", handlePhotoSync);
app.post("/api/photo-sync", handlePhotoSync);

app.listen(port, "0.0.0.0", () => {
  console.log(`Google Photos sync server listening on http://0.0.0.0:${port}`);
});
