import { getApps, initializeApp } from "firebase/app";
import { getDownloadURL, getMetadata, getStorage, listAll, ref, uploadBytes } from "firebase/storage";

const STORAGE_KEY = "wedding-gallery-photos-v1";
const MAX_SAVED_PHOTOS = 10;
const DEFAULT_DRIVE_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbwjtYZFVLi83kVse8CBQsdta65fKDROJRYL3vVEfb--MQ3GGq7TvfYlW75EqTU1K6vj/exec?secret=2ebb40f0f7ed46249b0a77591f559546";

function getFirebaseConfig() {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID,
  } = import.meta.env;

  const isConfigured = [
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID,
  ].every(Boolean);

  if (!isConfigured) {
    return null;
  }

  return {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: VITE_FIREBASE_APP_ID,
  };
}

function getFirebaseStorageInstance() {
  const config = getFirebaseConfig();

  if (!config) {
    return null;
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  return getStorage(app);
}

function getSyncWebhookConfig() {
  const { VITE_PHOTO_SYNC_WEBHOOK_URL, VITE_PHOTO_SYNC_WEBHOOK_SECRET } = import.meta.env;
  const resolvedUrl = VITE_PHOTO_SYNC_WEBHOOK_URL || DEFAULT_DRIVE_WEBHOOK_URL;

  if (!resolvedUrl) {
    return null;
  }

  return {
    url: resolvedUrl,
    secret: VITE_PHOTO_SYNC_WEBHOOK_SECRET || "",
  };
}

function sanitizeFileName(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9.-]/g, "");
}

function isImageFile(file) {
  return typeof file?.type === "string" && file.type.startsWith("image/");
}

function isVideoFile(file) {
  return typeof file?.type === "string" && file.type.startsWith("video/");
}

function detectMediaType(fileOrMime) {
  const mimeType = typeof fileOrMime === "string" ? fileOrMime : fileOrMime?.type || "";

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return "image";
}

function getExtensionFromMimeType(mimeType, fallback = "jpg") {
  const normalized = (mimeType || "").toLowerCase();

  if (!normalized.includes("/")) {
    return fallback;
  }

  const subtype = normalized.split("/")[1] || "";

  if (!subtype) {
    return fallback;
  }

  if (subtype.includes("jpeg")) {
    return "jpg";
  }

  if (subtype.includes("quicktime")) {
    return "mov";
  }

  if (subtype.includes("x-matroska")) {
    return "mkv";
  }

  return subtype.replace(/[^a-z0-9]/g, "") || fallback;
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file) {
  const dataUrl = await readBlobAsDataUrl(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("The selected file is not a supported image."));
    image.src = dataUrl;
  });

  const maxDimension = 1440;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Your browser could not prepare this image for upload.");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });

  if (!blob) {
    throw new Error("Image compression failed. Please try another photo.");
  }

  return blob;
}

async function prepareUploadBlob(file) {
  if (isImageFile(file)) {
    return {
      blob: await compressImage(file),
      contentType: "image/jpeg",
      mediaType: "image",
      extension: "jpg",
    };
  }

  if (isVideoFile(file)) {
    return {
      blob: file,
      contentType: file.type || "video/mp4",
      mediaType: "video",
      extension: getExtensionFromMimeType(file.type, "mp4"),
    };
  }

  throw new Error("Unsupported file type. Please upload images or videos.");
}

function readStoredPhotos() {
  const rawPhotos = window.localStorage.getItem(STORAGE_KEY);

  if (!rawPhotos) {
    return [];
  }

  try {
    return JSON.parse(rawPhotos);
  } catch (error) {
    return [];
  }
}

function toStorablePhoto(photo) {
  const storable = {
    id: photo.id,
    name: photo.name,
    mediaType: photo.mediaType || "image",
    mimeType: photo.mimeType || "",
    source: photo.source,
    createdAt: photo.createdAt,
    sync: photo.sync,
  };

  // Data URLs quickly exceed localStorage quota.
  // Persist only remotely hosted URLs.
  if (typeof photo.url === "string" && !photo.url.startsWith("data:") && !photo.url.startsWith("blob:")) {
    storable.url = photo.url;
  }

  if (
    typeof photo.downloadUrl === "string" &&
    !photo.downloadUrl.startsWith("data:") &&
    !photo.downloadUrl.startsWith("blob:")
  ) {
    storable.downloadUrl = photo.downloadUrl;
  }

  return storable;
}

function writeStoredPhotos(photos) {
  const trimmed = photos.slice(0, MAX_SAVED_PHOTOS).map(toStorablePhoto);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    // If storage quota is exceeded, keep the app usable by clearing the cache.
    // Drive/Firebase can still be loaded via remote sources.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_ignored) {
      // Intentionally ignore storage cleanup failures.
    }
  }
}

export async function loadStoredPhotos() {
  const storage = getFirebaseStorageInstance();

  if (storage) {
    try {
      const folderRef = ref(storage, "wedding-gallery");
      const listed = await listAll(folderRef);

      const firebasePhotos = await Promise.all(
        listed.items.map(async (itemRef) => {
          const [url, metadata] = await Promise.all([getDownloadURL(itemRef), getMetadata(itemRef)]);
          const originalName = metadata.customMetadata?.originalName || itemRef.name;
          const createdAt = metadata.customMetadata?.createdAt || metadata.timeCreated || new Date().toISOString();

          return {
            id: itemRef.name,
            name: originalName,
            url,
            downloadUrl: url,
            mediaType: metadata.customMetadata?.mediaType || detectMediaType(metadata.contentType),
            mimeType: metadata.contentType || "",
            source: "firebase",
            createdAt,
            sync: metadata.customMetadata?.sync || "firebase-only",
          };
        })
      );

      const sortedPhotos = firebasePhotos
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
        .slice(0, MAX_SAVED_PHOTOS);

      writeStoredPhotos(sortedPhotos);
      return sortedPhotos;
    } catch (error) {
      // Fall back to local cache if listing fails.
    }
  }

  return readStoredPhotos().filter((photo) => photo.url && photo.downloadUrl);
}

export function getUploadMode() {
  return getFirebaseStorageInstance() ? "firebase" : "simulated";
}

export function getSyncMode() {
  return getSyncWebhookConfig() ? "webhook" : "none";
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      const isRetryableStatus = response.status >= 500 || response.status === 429 || response.status === 408;

      if (!isRetryableStatus || attempt === attempts) {
        return response;
      }
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        throw error;
      }
    }

    await wait(attempt * 500);
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Request failed.");
}

export async function loadDrivePhotos(limit = 120) {
  const config = getSyncWebhookConfig();

  if (!config) {
    throw new Error("Drive webhook is not configured.");
  }

  const isAppsScriptWebhook = /script\.google\.com\/macros\/s\//i.test(config.url);

  if (!isAppsScriptWebhook) {
    throw new Error("All Photos currently works with Google Apps Script webhook URLs.");
  }

  const endpoint = new URL(config.url);
  endpoint.searchParams.set("action", "list");
  endpoint.searchParams.set("limit", String(limit));

  let response;

  try {
    response = await fetch(endpoint.toString(), {
      method: "GET",
      mode: "cors",
    });
  } catch (error) {
    throw new Error("Unable to reach Drive script. Please redeploy Apps Script web app and try again.");
  }

  if (!response.ok) {
    throw new Error(`Unable to load Drive photos: ${response.status}`);
  }

  const responseText = await response.text();
  let result;

  try {
    result = JSON.parse(responseText);
  } catch (error) {
    if (responseText.includes("Script function not found: doGet")) {
      throw new Error("Apps Script is old version. Deploy latest script version from Manage deployments.");
    }

    throw new Error("Drive list response was not valid. Please redeploy Apps Script web app.");
  }

  if (!result?.ok) {
    throw new Error(result?.message || "Unable to load Drive photos.");
  }

  const photos = Array.isArray(result.photos) ? result.photos : [];

  return photos.map((photo) => ({
    id: photo.id,
    name: photo.name,
    url: photo.mediaType === "video" ? photo.downloadUrl || photo.webViewLink : photo.thumbnailUrl || photo.downloadUrl || photo.webViewLink,
    downloadUrl: photo.downloadUrl || photo.webViewLink,
    mediaType: photo.mediaType || detectMediaType(photo.mimeType || ""),
    mimeType: photo.mimeType || "",
    source: "drive",
    createdAt: photo.createdAt || new Date().toISOString(),
    sync: "forwarded",
  }));
}

async function forwardPhotoToSyncWebhook(photo) {
  const config = getSyncWebhookConfig();

  if (!config) {
    return "disabled";
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  const isAppsScriptWebhook = /script\.google\.com\/macros\/s\//i.test(config.url);
  const webhookPhoto = isAppsScriptWebhook
    ? {
        name: photo.name,
        createdAt: photo.createdAt,
        ...(photo.inlineDataUrl
          ? { inlineDataUrl: photo.inlineDataUrl }
          : { downloadUrl: photo.downloadUrl || photo.url }),
      }
    : photo;

  const payload = {
    photo: webhookPhoto,
    source: "wedding_invitation",
  };

  try {
    if (isAppsScriptWebhook) {
      // Use a simple CORS request for Apps Script and read response body.
      const response = await fetchWithRetry(config.url, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Drive webhook failed: ${response.status}`);
      }

      const result = await response.json().catch(() => ({}));

      if (!result?.ok) {
        const message = result?.message || "Drive webhook returned failure.";
        throw new Error(message);
      }

      return "forwarded";
    }

    const response = await fetchWithRetry(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.secret ? { "x-sync-secret": config.secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Sync webhook failed: ${response.status}`);
    }

    return "forwarded";
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";

    if (message.includes("Missing photo URL")) {
      return "failed:Drive script is using old version. Please deploy latest Apps Script version.";
    }

    if (message.includes("URLFetch URL length")) {
      return "failed:Drive script is using old version. Please deploy latest Apps Script version.";
    }

    return `failed:${message}`;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function uploadPhoto(file) {
  const prepared = await prepareUploadBlob(file);
  const mediaType = prepared.mediaType;
  const extension = prepared.extension;
  const mimeType = prepared.contentType;
  const fileName = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "wedding-photo";
  const photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const storage = getFirebaseStorageInstance();

  let url;
  let source = "simulated";
  const createdAt = new Date().toISOString();

  if (storage) {
    const fileRef = ref(storage, `wedding-gallery/${photoId}-${fileName}.${extension}`);

    await uploadBytes(fileRef, prepared.blob, {
      contentType: mimeType,
      customMetadata: {
        originalName: `${fileName}.${extension}`,
        mediaType,
        createdAt,
      },
    });

    url = await getDownloadURL(fileRef);
    source = "firebase";
  } else {
    if (mediaType === "image") {
      url = await readBlobAsDataUrl(prepared.blob);
    } else {
      url = URL.createObjectURL(file);
    }
  }

  const photo = {
    id: photoId,
    name: `${fileName}.${extension}`,
    url,
    downloadUrl: url,
    mediaType,
    mimeType,
    source,
    createdAt,
    sync: "firebase-only",
  };

  if (source !== "firebase" && mediaType === "image") {
    photo.inlineDataUrl = url;
  }

  if (source !== "firebase" && mediaType === "video") {
    photo.sync = "failed:Video sync needs Firebase upload or direct backend upload URL.";
  }

  if (getSyncWebhookConfig() && !(source !== "firebase" && mediaType === "video")) {
    photo.sync = await forwardPhotoToSyncWebhook(photo);
  }

  const currentPhotos = readStoredPhotos();
  writeStoredPhotos([photo, ...currentPhotos.filter((item) => item.id !== photo.id)]);

  return photo;
}
