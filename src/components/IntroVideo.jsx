import { useEffect, useRef } from "react";
import { motion } from "motion/react";

export function IntroVideo({ src, poster, onComplete }) {
  const videoRef = useRef(null);
  const completedRef = useRef(false);

  const completeIntro = () => {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return undefined;
    }

    let disposed = false;

    const playWithAudio = async () => {
      video.currentTime = 0;
      video.loop = false;
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
      video.autoplay = true;

      await video.play();
    };

    const playMutedFallback = async () => {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 1;
      video.autoplay = true;

      await video.play();
    };

    const tryAutoplay = async () => {
      try {
        await playWithAudio();
      } catch (error) {
        try {
          await playMutedFallback();
        } catch (retryError) {
          // The first interaction below will retry playback if needed.
        }
      }
    };

    const handleReady = () => {
      if (!disposed) {
        void tryAutoplay();
      }
    };

    const handleVideoError = () => {
      if (!disposed) {
        completeIntro();
      }
    };

    const unlockAudio = async () => {
      if (disposed || !video || video.ended) {
        return;
      }

      try {
        await playWithAudio();
      } catch (error) {
        // Ignore browser-level media restrictions here.
      }
    };

    if (video.readyState >= 2) {
      void tryAutoplay();
    } else {
      video.addEventListener("loadeddata", handleReady, { once: true });
    }

    video.addEventListener("error", handleVideoError);

    // Fail-safe so the invitation never gets stuck behind video autoplay restrictions.
    const failSafeTimer = window.setTimeout(() => {
      if (!disposed) {
        completeIntro();
      }
    }, 9000);

    window.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      disposed = true;
      window.clearTimeout(failSafeTimer);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("error", handleVideoError);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const handleEnded = () => {
    const video = videoRef.current;

    if (video) {
      video.pause();
    }

    completeIntro();
  };

  return (
    <motion.section
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.015,
        transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
      }}
      className="fixed inset-0 z-50 overflow-hidden bg-[#12070b]"
      aria-label="Wedding intro video"
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover object-center"
        src={src}
        poster={poster}
        preload="metadata"
        autoPlay
        playsInline
        onEnded={handleEnded}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,233,204,0.14),transparent_30%),linear-gradient(180deg,rgba(18,7,11,0.12)_0%,rgba(18,7,11,0.08)_45%,rgba(18,7,11,0.46)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#13070b] via-[#13070b]/20 to-transparent" />

      <button
        type="button"
        onClick={completeIntro}
        className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-[#f2d6a2]/70 bg-[rgba(68,19,20,0.72)] px-6 py-2.5 text-sm font-semibold tracking-[0.12em] text-[#ffe8c4] shadow-[0_10px_26px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:-translate-y-0.5"
      >
        ENTER INVITATION
      </button>
    </motion.section>
  );
}
