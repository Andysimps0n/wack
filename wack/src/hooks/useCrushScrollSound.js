import { useEffect, useRef } from "react";
import {
  CRUSH_AUDIO_END_PROGRESS,
  CRUSH_SCROLL_IDLE_MS,
  CRUSH_SOUND_DURATION_SEC,
  CRUSH_SOUND_URL,
  CRUSH_VOLUME,
} from "../constants/crush";

function getMaxScroll() {
  return document.documentElement.scrollHeight - window.innerHeight;
}

function crush01FromScrollY(scrollY) {
  const maxScroll = getMaxScroll();
  const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
  return Math.min(1, Math.max(0, progress / CRUSH_AUDIO_END_PROGRESS));
}

function audioDuration(audio) {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration;
  }
  return CRUSH_SOUND_DURATION_SEC;
}

function seekToCrush(audio, crush01) {
  const duration = audioDuration(audio);
  // Stay slightly under duration so the element does not latch on "ended".
  audio.currentTime = Math.min(crush01 * duration, Math.max(0, duration - 0.05));
}

// Plays crush.mp3 while the user is actively scrolling down.
// - isScrolling clears 100ms after the last scroll event
// - scroll up: mute + scrub currentTime back with crush progress
// - idle: pause (keep position)
// - scroll down: unmute, resume from scrubbed position
export default function useCrushScrollSound(enabled) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const audio = new Audio(CRUSH_SOUND_URL);
    audio.preload = "auto";
    audio.volume = CRUSH_VOLUME;
    audioRef.current = audio;

    let lastScrollY = window.scrollY;
    let direction = 1;
    let isScrolling = false;
    let idleTimerId = null;

    function applyAudioState() {
      const crush01 = crush01FromScrollY(window.scrollY);

      if (!isScrolling) {
        audio.pause();
        return;
      }

      // Upward scroll: mute and rewind the playhead with crush progress.
      if (direction < 0) {
        audio.volume = 0;
        audio.pause();
        seekToCrush(audio, crush01);
        return;
      }

      // Downward scroll: audible, synced to crush progress.
      if (crush01 >= 1) {
        seekToCrush(audio, 1);
        audio.pause();
        return;
      }

      const expected = crush01 * audioDuration(audio);
      if (audio.paused) {
        seekToCrush(audio, crush01);
      } else if (Math.abs(audio.currentTime - expected) > 0.08) {
        // Soft-correct drift if wheel velocity and playback diverge.
        seekToCrush(audio, crush01);
      }

      audio.volume = CRUSH_VOLUME;
      audio.play().catch(() => {
        // Autoplay may block until a user gesture; wheel counts as one.
      });
    }

    function handleScroll() {
      const scrollY = window.scrollY;
      const deltaY = scrollY - lastScrollY;
      if (deltaY !== 0) {
        direction = Math.sign(deltaY);
      }
      lastScrollY = scrollY;

      isScrolling = true;
      if (idleTimerId !== null) clearTimeout(idleTimerId);
      idleTimerId = setTimeout(() => {
        idleTimerId = null;
        isScrolling = false;
        audio.pause();
      }, CRUSH_SCROLL_IDLE_MS);

      applyAudioState();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (idleTimerId !== null) clearTimeout(idleTimerId);
      audio.pause();
      audioRef.current = null;
    };
  }, [enabled]);
}
