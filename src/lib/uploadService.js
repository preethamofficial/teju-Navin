import { getApps, initializeApp } from "firebase/app";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

const STORAGE_KEY = "wedding-gallery-photos-v1";
const MAX_SAVED_PHOTOS = 12;

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

function sanitizeFileName(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9.-]/g, "");
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the uploaded image."));
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

function writeStoredPhotos(photos) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(photos.slice(0, MAX_SAVED_PHOTOS)));
}

export async function loadStoredPhotos() {
  return readStoredPhotos();
}

export function getUploadMode() {
  return getFirebaseStorageInstance() ? "firebase" : "simulated";
}

export async function uploadPhoto(file) {
  const optimizedImage = await compressImage(file);
  const fileName = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "wedding-photo";
  const photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const storage = getFirebaseStorageInstance();

  let url;
  let source = "simulated";

  if (storage) {
    const fileRef = ref(storage, `wedding-gallery/${photoId}-${fileName}.jpg`);
    await uploadBytes(fileRef, optimizedImage, { contentType: "image/jpeg" });
    url = await getDownloadURL(fileRef);
    source = "firebase";
  } else {
    // Google Photos direct uploads need OAuth and user-scoped APIs, so this app
    // ships with a Firebase-ready adapter and a local simulation fallback.
    url = await readBlobAsDataUrl(optimizedImage);
  }

  const photo = {
    id: photoId,
    name: `${fileName}.jpg`,
    url,
    downloadUrl: url,
    source,
    createdAt: new Date().toISOString(),
  };

  const currentPhotos = readStoredPhotos();
  writeStoredPhotos([photo, ...currentPhotos.filter((item) => item.id !== photo.id)]);

  return photo;
}
