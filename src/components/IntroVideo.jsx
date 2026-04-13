import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

export function IntroVideo({ src, poster, onComplete }) {
  const videoRef = useRef(null);
  const completedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const failSafeTimerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

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

    // Skip intro on very constrained connections to avoid a stuck first experience.
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isConstrainedNetwork = Boolean(
      connection && (connection.saveData || /(^|\b)(slow-2g|2g)(\b|$)/.test(connection.effectiveType || ""))
    );

    if (isConstrainedNetwork) {
      completeIntro();
      return undefined;
    }

    const playMuted = async () => {
      video.loop = false;
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 1;
      video.autoplay = true;
      setIsMuted(true);
      await video.play();
    };

    const tryAutoplayMuted = async () => {
      try {
        await playMuted();
      } catch (error) {
        // Ignore autoplay failures. Fail-safe handles no-play scenarios.
      }
    };

    const handleReady = () => {
      if (!disposed) {
        void tryAutoplayMuted();
      }
    };

    const handlePlaying = () => {
      playbackStartedRef.current = true;
      if (failSafeTimerRef.current) {
        window.clearTimeout(failSafeTimerRef.current);
        failSafeTimerRef.current = null;
      }
    };

    const handleVideoError = () => {
      if (!disposed) {
        completeIntro();
      }
    };

    const handleStalled = () => {
      if (!disposed && !playbackStartedRef.current) {
        // If startup buffering stalls too long, skip intro instead of freezing.
        if (progressTimerRef.current) {
          window.clearTimeout(progressTimerRef.current);
        }

        progressTimerRef.current = window.setTimeout(() => {
          if (!disposed && !playbackStartedRef.current) {
            completeIntro();
          }
        }, 2500);
      }
    };

    video.preload = "metadata";

    if (video.readyState >= 3) {
      void tryAutoplayMuted();
    } else {
      video.addEventListener("canplay", handleReady, { once: true });
    }

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("waiting", handleStalled);
    video.addEventListener("error", handleVideoError);

    // Fail-safe only when playback never starts.
    failSafeTimerRef.current = window.setTimeout(() => {
      if (!disposed) {
        if (!playbackStartedRef.current) {
          completeIntro();
        }
      }
    }, 7000);

    return () => {
      disposed = true;
      if (failSafeTimerRef.current) {
        window.clearTimeout(failSafeTimerRef.current);
      }
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("waiting", handleStalled);
      video.removeEventListener("error", handleVideoError);
    };
  }, []);

  const handleToggleMute = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    video.defaultMuted = nextMuted;
    setIsMuted(nextMuted);
  };

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
        muted
        playsInline
        onEnded={handleEnded}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,233,204,0.14),transparent_30%),linear-gradient(180deg,rgba(18,7,11,0.12)_0%,rgba(18,7,11,0.08)_45%,rgba(18,7,11,0.46)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#13070b] via-[#13070b]/20 to-transparent" />

      <button
        type="button"
        onClick={handleToggleMute}
        className="absolute right-4 top-4 rounded-full border border-[#f2d6a2]/65 bg-[rgba(68,19,20,0.65)] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-[#ffe8c4] backdrop-blur-sm"
      >
        {isMuted ? "TAP FOR SOUND" : "MUTED OFF"}
      </button>

      <button
        type="button"
        onClick={completeIntro}
        className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-[#f2d6a2]/70 bg-[rgba(68,19,20,0.72)] px-6 py-2.5 text-sm font-semibold tracking-[0.12em] text-[#ffe8c4] shadow-[0_10px_26px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:-translate-y-0.5"
      >
        SKIP INTRO
      </button>
    </motion.section>
  );
}
