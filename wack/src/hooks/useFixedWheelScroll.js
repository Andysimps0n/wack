import { useEffect } from "react";
import {
  CRUSH_AUDIO_END_PROGRESS,
  CRUSH_SCROLL_IDLE_MS,
  CRUSH_SOUND_DURATION_SEC,
} from "../constants/crush";

function getMaxScroll() {
  return document.documentElement.scrollHeight - window.innerHeight;
}

// Target scroll speed so continuous wheel input covers the crush range
// in roughly the crush-sound duration (end of squash ≈ end of sound).
function crushScrollSpeedPxPerSec() {
  const maxScroll = getMaxScroll();
  if (maxScroll <= 0) return 0;
  return (CRUSH_AUDIO_END_PROGRESS * maxScroll) / CRUSH_SOUND_DURATION_SEC;
}

// Hijacks wheel/trackpad: ignore native delta size, scroll at a fixed
// velocity while the user keeps wheeling. Touch/keyboard/scrollbar stay native.
export default function useFixedWheelScroll(enabled) {
  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;
    let lastTs = 0;
    let direction = 0;
    let lastWheelAt = 0;

    function tick(ts) {
      rafId = requestAnimationFrame(tick);

      if (performance.now() - lastWheelAt > CRUSH_SCROLL_IDLE_MS) {
        direction = 0;
        lastTs = 0;
        cancelAnimationFrame(rafId);
        rafId = 0;
        return;
      }

      if (!lastTs) {
        lastTs = ts;
        return;
      }

      const dtSec = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      if (direction === 0) return;

      window.scrollBy(0, direction * crushScrollSpeedPxPerSec() * dtSec);
    }

    function onWheel(event) {
      if (event.deltaY === 0) return;
      event.preventDefault();
      direction = Math.sign(event.deltaY);
      lastWheelAt = performance.now();
      if (!rafId) {
        lastTs = 0;
        rafId = requestAnimationFrame(tick);
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enabled]);
}
