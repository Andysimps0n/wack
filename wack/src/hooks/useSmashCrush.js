import { useCallback, useEffect, useRef, useState } from "react";
import {
  CRUSH_SOUND_DURATION_SEC,
  CRUSH_SOUND_URL,
  CRUSH_VOLUME,
  WHOOSH_SOUND_URL,
  WHOOSH_VOLUME,
} from "../constants/crush";

function audioDuration(audio) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration;
  }
  return CRUSH_SOUND_DURATION_SEC;
}

// Owns crush audio + playhead-synced progress for the Smash button.
// Cycle: idle → smashing → done → blowing → dropping → idle
export default function useSmashCrush() {
  const [status, setStatus] = useState("idle");
  const [crushProgress, setCrushProgress] = useState(0);
  // Bump this to remount Apple after debris is cleared (fresh wax + squash).
  const [appleKey, setAppleKey] = useState(0);
  const audioRef = useRef(null);
  const whooshAudioRef = useRef(null);
  const rafRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const audio = new Audio(CRUSH_SOUND_URL);
    audio.preload = "auto";
    audio.volume = CRUSH_VOLUME;
    audioRef.current = audio;

    const whoosh = new Audio(WHOOSH_SOUND_URL);
    whoosh.preload = "auto";
    whoosh.volume = WHOOSH_VOLUME;
    whooshAudioRef.current = whoosh;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audio.pause();
      audioRef.current = null;
      whoosh.pause();
      whooshAudioRef.current = null;
    };
  }, []);

  const finish = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setCrushProgress(1);
    setStatus("done");
  }, []);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || statusRef.current !== "smashing") return;

    const duration = audioDuration(audio);
    const progress = Math.min(1, Math.max(0, audio.currentTime / duration));
    setCrushProgress(progress);

    if (progress >= 1 || audio.ended) {
      finish();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [finish]);

  const smash = useCallback(() => {
    if (statusRef.current !== "idle") return;

    const audio = audioRef.current;
    if (!audio) return;

    setStatus("smashing");
    statusRef.current = "smashing";
    audio.currentTime = 0;
    setCrushProgress(0);

    const playPromise = audio.play();
    const startLoop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    if (playPromise && typeof playPromise.then === "function") {
      playPromise.then(startLoop).catch(() => {
        // Autoplay blocked or play failed — stay idle so the user can retry.
        setStatus("idle");
        statusRef.current = "idle";
        setCrushProgress(0);
      });
    } else {
      startLoop();
    }
  }, [tick]);

  // Called by Apple after the 1s hold on the crushed apple.
  const startBlow = useCallback(() => {
    if (statusRef.current !== "done") return;
    setStatus("blowing");
    statusRef.current = "blowing";

    // Play whoosh with the blow — same user-gesture chain as smash, so browsers
    // usually allow it. Fail quietly if the file is missing / blocked.
    const whoosh = whooshAudioRef.current;
    if (whoosh) {
      whoosh.currentTime = 0;
      whoosh.play().catch(() => {});
    }
  }, []);

  // Called by Apple once debris is gone — remount a fresh apple high above.
  const handleCleared = useCallback(() => {
    if (statusRef.current !== "blowing") return;
    setCrushProgress(0);
    setAppleKey((key) => key + 1);
    setStatus("dropping");
    statusRef.current = "dropping";
  }, []);

  // Called by Apple when the fresh apple reaches its rest position.
  const handleSettled = useCallback(() => {
    if (statusRef.current !== "dropping") return;
    setStatus("idle");
    statusRef.current = "idle";
  }, []);

  return {
    crushProgress,
    status,
    appleKey,
    smash,
    startBlow,
    handleCleared,
    handleSettled,
  };
}
