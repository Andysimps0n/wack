import { useCallback, useEffect, useRef, useState } from "react";
import {
  CRUSH_SOUND_DURATION_SEC,
  CRUSH_SOUND_URL,
  CRUSH_VOLUME,
} from "../constants/crush";

function audioDuration(audio) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration;
  }
  return CRUSH_SOUND_DURATION_SEC;
}

// Owns crush audio + playhead-synced progress for the Smash button.
// States: idle → smashing → done (stays crushed until reload).
export default function useSmashCrush() {
  const [status, setStatus] = useState("idle");
  const [crushProgress, setCrushProgress] = useState(0);
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const audio = new Audio(CRUSH_SOUND_URL);
    audio.preload = "auto";
    audio.volume = CRUSH_VOLUME;
    audioRef.current = audio;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audio.pause();
      audioRef.current = null;
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

  return { crushProgress, status, smash };
}
