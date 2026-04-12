// Google Apps Script: Direct upload endpoint to save images/videos into your Google Drive folder.
// Deploy as Web App (Execute as: Me, Who has access: Anyone with the link).

const CONFIG = {
  // Paste only the folder ID (or keep link and auto-parse below).
  DRIVE_FOLDER_ID: "",
  // Optional: if you prefer, paste a folder link here instead of ID.
  DRIVE_FOLDER_LINK: "https://drive.google.com/drive/folders/1yapxeu3Fwi1fgdCV92niDPKEAgp_UCyX?usp=sharing",
  // Keep this secret and match with VITE_PHOTO_SYNC_WEBHOOK_SECRET.
  WEBHOOK_SECRET: "2ebb40f0f7ed46249b0a77591f559546",
};

function getFolderId() {
  if (CONFIG.DRIVE_FOLDER_ID) {
    return CONFIG.DRIVE_FOLDER_ID.trim();
  }

  const link = (CONFIG.DRIVE_FOLDER_LINK || "").trim();
  if (!link) {
    throw new Error("Set DRIVE_FOLDER_ID or DRIVE_FOLDER_LINK.");
  }

  const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  const idMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  throw new Error("Unable to parse folder id from DRIVE_FOLDER_LINK.");
}

function sanitizeFileName(name) {
  return (name || "wedding-media")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");
}

function verifySecret(providedSecret) {
  const expectedSecret = CONFIG.WEBHOOK_SECRET || "";
  if (expectedSecret && providedSecret !== expectedSecret) {
    throw new Error("Invalid secret");
  }
}

function getQueryParam(e, key) {
  return (e && e.parameter && e.parameter[key]) || "";
}

function buildDriveMediaItem(file) {
  const fileId = file.getId();
  const mimeType = file.getMimeType() || "";
  const mediaType = mimeType.indexOf("video/") === 0 ? "video" : "image";

  return {
    id: fileId,
    name: file.getName(),
    mimeType: mimeType,
    mediaType: mediaType,
    createdAt: file.getDateCreated().toISOString(),
    updatedAt: file.getLastUpdated().toISOString(),
    webViewLink: file.getUrl(),
    // Requires file to be shared with link view access.
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
  };
}

function listDrivePhotos(limit) {
  const folder = DriveApp.getFolderById(getFolderId());
  const files = folder.getFiles();
  const photos = [];

  while (files.hasNext()) {
    const file = files.next();
    photos.push(buildDriveMediaItem(file));
  }

  photos.sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return photos.slice(0, limit);
}

function doGet(e) {
  try {
    const action = getQueryParam(e, "action");
    const secret = getQueryParam(e, "secret");
    verifySecret(secret);

    if (action === "list") {
      const rawLimit = Number(getQueryParam(e, "limit") || "120");
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 500)) : 120;
      return json({ ok: true, photos: listDrivePhotos(limit) }, 200);
    }

    return json({ ok: true, message: "Drive sync endpoint is running." }, 200);
  } catch (error) {
    return json(
      {
        ok: false,
        message: error && error.message ? error.message : "Unknown error",
      },
      500
    );
  }
}

function blobFromDataUrl(dataUrl, fileName) {
  const match = (dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid inline media data format.");
  }

  const mimeType = match[1] || "image/jpeg";
  const base64Data = match[2] || "";
  const bytes = Utilities.base64Decode(base64Data);
  return Utilities.newBlob(bytes, mimeType, fileName);
}

function getExtensionFromMimeType(mimeType) {
  const normalized = (mimeType || "").toLowerCase();

  if (normalized.indexOf("image/jpeg") === 0) {
    return "jpg";
  }

  if (normalized.indexOf("image/png") === 0) {
    return "png";
  }

  if (normalized.indexOf("image/webp") === 0) {
    return "webp";
  }

  if (normalized.indexOf("video/mp4") === 0) {
    return "mp4";
  }

  if (normalized.indexOf("video/quicktime") === 0) {
    return "mov";
  }

  if (normalized.indexOf("video/webm") === 0) {
    return "webm";
  }

  return "bin";
}

function doPost(e) {
  try {
    const secret = getQueryParam(e, "secret");
    verifySecret(secret);
    const bodyText = (e && e.postData && e.postData.contents) || "{}";
    const payload = JSON.parse(bodyText);

    const media = payload.media || payload.photo || {};
    const url = media.downloadUrl || media.url;
    const mimeType = (media.mimeType || "").toString();
    const extensionFromMime = getExtensionFromMimeType(mimeType);

    const baseName = sanitizeFileName(media.name || "wedding-media").replace(/\.[a-z0-9]+$/i, "");
    const fileName = /\.[a-z0-9]+$/i.test(media.name || "")
      ? sanitizeFileName(media.name)
      : `${baseName || "wedding-media"}.${extensionFromMime}`;
    const inlineDataUrl = media.inlineDataUrl || (url && url.startsWith("data:") ? url : "");

    let blob;

    if (inlineDataUrl) {
      blob = blobFromDataUrl(inlineDataUrl, fileName);
    } else {
      if (!url) {
        return json({ ok: false, message: "Missing media URL" }, 400);
      }

      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
        return json({ ok: false, message: "Could not download media" }, 502);
      }

      blob = response.getBlob();
      if (mimeType) {
        blob = blob.setContentType(mimeType);
      }
      blob.setName(fileName);
    }

    const folder = DriveApp.getFolderById(getFolderId());
    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      // Sharing can fail in restricted domains; save still succeeds.
    }

    return json({
      ok: true,
      uploaded: {
        googleDrive: {
          fileId: file.getId(),
          name: file.getName(),
          webViewLink: file.getUrl(),
          mimeType: file.getMimeType(),
        },
      },
    });
  } catch (error) {
    return json({
      ok: false,
      message: error && error.message ? error.message : "Unknown error",
    }, 500);
  }
}

function json(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  // Apps Script web apps ignore custom HTTP status in many cases, but body remains consistent.
  return output;
}
