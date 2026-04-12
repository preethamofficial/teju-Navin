import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloseIcon, DownloadIcon, PhotoIcon, PlayIcon, UploadCloudIcon } from "./Icons";
import { SectionHeading } from "./SectionHeading";
import { getSyncMode, getUploadMode, loadDrivePhotos, loadStoredPhotos, uploadPhoto } from "../lib/uploadService";

function formatDateLabel(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function GalleryLightbox({ photo, onClose }) {
  return (
    <AnimatePresence>
      {photo ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#18090d]/88 px-4 py-8 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/15 bg-[#2b1218] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.4)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white transition hover:bg-black/50"
              aria-label="Close photo preview"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            {photo.mediaType === "video" ? (
              <video
                src={photo.downloadUrl || photo.url}
                controls
                playsInline
                className="max-h-[80vh] w-full rounded-[1.4rem] bg-[#12070b]"
              />
            ) : (
              <img
                src={photo.url}
                alt={photo.name}
                className="max-h-[80vh] w-full rounded-[1.4rem] object-contain bg-[#12070b]"
              />
            )}

            <div className="flex flex-col gap-4 px-3 pb-3 pt-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-3xl text-[#f8d9a8]">{photo.name}</p>
                <p className="mt-1 text-sm text-white/72">
                  Uploaded {formatDateLabel(photo.createdAt)} |{" "}
                  {photo.source === "firebase"
                    ? "Synced to Firebase Storage"
                    : photo.source === "drive"
                      ? "Loaded from Google Drive"
                      : "Saved with simulated cloud storage"}
                  {photo.mediaType === "video" ? " | Video" : " | Image"}
                </p>
              </div>

              <a
                href={photo.downloadUrl}
                download={photo.name}
                className="inline-flex items-center gap-2 rounded-full border border-[#f1d1a2]/35 bg-[#f3e5ca]/10 px-5 py-3 text-sm font-semibold text-[#f7dfba] transition hover:bg-[#f3e5ca]/18"
              >
                <DownloadIcon className="h-4 w-4" />
                Download file
              </a>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function PhotoGallerySection() {
  const fileInputRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [visibleMediaCount, setVisibleMediaCount] = useState(40);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingAllPhotos, setLoadingAllPhotos] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activePhoto, setActivePhoto] = useState(null);
  const MEDIA_PAGE_SIZE = 40;
  const uploadMode = getUploadMode();
  const syncMode = getSyncMode();
  const deferredPhotos = useDeferredValue(photos);
  const visiblePhotos = deferredPhotos.slice(0, visibleMediaCount);
  const hasMorePhotos = deferredPhotos.length > visibleMediaCount;

  useEffect(() => {
    loadStoredPhotos().then((storedPhotos) => {
      setPhotos(storedPhotos);
      setVisibleMediaCount(MEDIA_PAGE_SIZE);
    });
  }, []);

  async function processFiles(fileList) {
    const files = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, 6);

    if (files.length === 0) {
      setStatus("Please choose image or video files to continue.");
      return;
    }

    setUploading(true);
    setStatus(
      uploadMode === "firebase"
        ? "Uploading media to Firebase Storage..."
        : "Saving media now and simulating cloud sync..."
    );

    try {
      const uploadedPhotos = [];

      for (const file of files) {
        const uploadedPhoto = await uploadPhoto(file);
        uploadedPhotos.push(uploadedPhoto);
      }

      const syncedCount = uploadedPhotos.filter((photo) => photo.sync === "forwarded").length;
      const failedSync = uploadedPhotos.filter((photo) => typeof photo.sync === "string" && photo.sync.startsWith("failed:"));

      startTransition(() => {
        setPhotos((currentPhotos) => {
          const mergedPhotos = [
            ...uploadedPhotos,
            ...currentPhotos.filter(
              (currentPhoto) => !uploadedPhotos.some((uploadedPhoto) => uploadedPhoto.id === currentPhoto.id)
            ),
          ];

          return mergedPhotos.slice(0, 10);
        });
        setVisibleMediaCount(MEDIA_PAGE_SIZE);
      });

      if (failedSync.length > 0) {
        const firstReason = failedSync[0].sync.replace(/^failed:/, "");
        setStatus(`Upload saved, but Drive sync failed: ${firstReason}`);
      } else if (syncMode === "webhook") {
        setStatus(`Upload complete. ${syncedCount} file(s) synced to Google Drive.`);
      } else if (uploadMode === "firebase") {
        setStatus("Upload complete. Your gallery media is now synced to Firebase Storage.");
      } else {
        setStatus("Upload complete. Media is saved locally.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(event) {
    if (event.target.files?.length) {
      processFiles(event.target.files);
      event.target.value = "";
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    if (event.dataTransfer.files?.length) {
      processFiles(event.dataTransfer.files);
    }
  }

  async function handleLoadAllPhotos() {
    if (loadingAllPhotos) {
      return;
    }

    setLoadingAllPhotos(true);
    setStatus("Loading all media from Google Drive...");

    try {
      const drivePhotos = await loadDrivePhotos(200);
      const smoothLimit = 120;
      setPhotos(drivePhotos.slice(0, smoothLimit));
      setVisibleMediaCount(MEDIA_PAGE_SIZE);
      setStatus(`Loaded ${drivePhotos.length} file(s). Showing first ${Math.min(drivePhotos.length, smoothLimit)} for smooth scrolling.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load Drive media.");
    } finally {
      setLoadingAllPhotos(false);
    }
  }

  return (
    <section id="gallery" className="section-shell pb-24 pt-14">
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="royal-panel royal-corners rounded-[2rem] p-6 sm:p-8"
      >
        <SectionHeading
          eyebrow="Blessings & Memories"
          title="Wedding memories will be shared here"
          subtitle="Images and videos from the celebration can be uploaded here, revisited later, and downloaded anytime by family and friends."
        />

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget === event.target) {
              setDragging(false);
            }
          }}
          onDrop={handleDrop}
          className={`mt-8 rounded-[1.7rem] border-2 border-dashed px-5 py-8 text-center transition sm:px-7 ${
            dragging
              ? "border-[#c78a4c] bg-[#fff8ef]"
              : "border-[#d7b48a]/70 bg-[linear-gradient(180deg,rgba(255,252,248,0.9),rgba(251,242,228,0.7))]"
          }`}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff7ea] text-[#b9783e] shadow-[0_12px_30px_rgba(185,120,62,0.18)]">
            <UploadCloudIcon className="h-8 w-8" />
          </div>

          <h3 className="mt-5 font-display text-[2.8rem] text-[#5d2028] sm:text-[3.35rem]">Upload wedding media</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#6e4a47] sm:text-base">
            Add recent celebration images and videos from your phone or desktop, and they will appear below in a simple,
            elegant, and mobile-friendly gallery.
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-xs uppercase tracking-[0.22em] text-[#8a645e]">
            Showing latest 10 media files
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-[#6a2330] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(106,35,48,0.22)] transition hover:-translate-y-0.5 hover:bg-[#571b27]"
            >
              <PhotoIcon className="h-4 w-4" />
              {uploading ? "Uploading..." : "Choose files"}
            </button>

            <button
              type="button"
              onClick={handleLoadAllPhotos}
              disabled={loadingAllPhotos}
              className="inline-flex items-center gap-2 rounded-full border border-[#6a2330]/30 bg-white/70 px-6 py-3 text-sm font-semibold text-[#6a2330] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              <PhotoIcon className="h-4 w-4" />
              {loadingAllPhotos ? "Loading..." : "All media"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="mt-5 flex flex-col items-center gap-2 text-center text-xs uppercase tracking-[0.24em] text-[#8a645e] sm:justify-center">
            <span>{status || "Ready for wedding media uploads from mobile or desktop"}</span>
            <span>
              {uploadMode === "firebase"
                ? syncMode === "webhook"
                  ? "Firebase live + Google Drive webhook"
                  : "Firebase Storage live"
                : syncMode === "webhook"
                  ? "Direct Google Drive webhook"
                  : "Cloud sync simulated"}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="section-eyebrow">Gallery</p>
          <h3 className="royal-title royal-title-embossed text-[2.75rem] leading-[0.9] sm:text-[3.45rem]">Recent Memories</h3>
        </div>
        <span className="rounded-full border border-[#d6b385]/60 bg-white/55 px-4 py-2 text-xs uppercase tracking-[0.26em] text-[#8a645e]">
          {deferredPhotos.length} saved
        </span>
      </div>

      {deferredPhotos.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActivePhoto(photo)}
              className="group gallery-thumb text-center"
            >
              <div className="relative aspect-[0.88] overflow-hidden rounded-[1.25rem]">
                {photo.mediaType === "video" ? (
                  <video
                    src={photo.url}
                    muted
                    playsInline
                    preload="none"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <img
                    src={photo.url}
                    alt={photo.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(28,10,14,0.05)_45%,rgba(28,10,14,0.62)_100%)]" />
                {photo.mediaType === "video" ? (
                  <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/35 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    <PlayIcon className="h-3.5 w-3.5" />
                    Video
                  </span>
                ) : null}
                <a
                  href={photo.downloadUrl}
                  download={photo.name}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label={`Download ${photo.name}`}
                >
                  <DownloadIcon className="h-4 w-4" />
                </a>
              </div>

              <div className="px-1 pb-1 pt-3 text-center">
                <p className="truncate font-semibold text-[#4f1e28]">{photo.name}</p>
                <div className="mt-1 flex justify-center">
                  <span className="inline-flex items-center rounded-full border border-[#c8954f]/45 bg-[#fff7e8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a5a2f]">
                    {photo.mediaType === "video" ? "Video" : "Image"}
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8a645e]">
                  {photo.source === "firebase"
                    ? "Firebase"
                    : photo.source === "drive"
                      ? "Google Drive"
                      : "Simulated cloud"} | {formatDateLabel(photo.createdAt)}
                </p>
                <p className="mt-1 text-[11px] text-[#8a645e]">
                  {photo.sync === "forwarded"
                    ? "Drive sync: success"
                    : typeof photo.sync === "string" && photo.sync.startsWith("failed:")
                      ? "Drive sync: failed"
                      : "Drive sync: pending"}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.6rem] border border-[#dcc19d]/60 bg-white/55 px-6 py-10 text-center text-[#7d5953] shadow-[0_16px_40px_rgba(112,66,49,0.08)]">
          <PhotoIcon className="mx-auto h-10 w-10 text-[#c18649]" />
          <p className="mt-4 font-display text-3xl text-[#5d2028]">No memories yet</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 sm:text-base">
            The latest wedding images and videos will appear here with preview and download options.
          </p>
        </div>
      )}

      {hasMorePhotos ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleMediaCount((current) => current + MEDIA_PAGE_SIZE)}
            className="inline-flex items-center gap-2 rounded-full border border-[#b37a3f]/45 bg-[#fff6e6] px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#7b4625] transition hover:-translate-y-0.5 hover:bg-[#fff0d7]"
          >
            Load more
          </button>
        </div>
      ) : null}

      <div className="mt-10 text-center">
        <p className="font-display text-[1.8rem] text-[#6a2330] sm:text-[2.2rem]">Thank you</p>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-[#7d5953] sm:text-base">
          Thank you for being part of our celebration and for sharing your beautiful memories with us.
        </p>
      </div>

      <GalleryLightbox photo={activePhoto} onClose={() => setActivePhoto(null)} />
    </section>
  );
}
