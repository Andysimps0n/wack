import { useRef } from "react";

const TWO_PI = Math.PI * 2;

/** Wrap any radian angle into [0, 1) — progress through the current spin. */
function spinProgress(rotationY) {
  return (((rotationY % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI;
}

/**
 * Horizontal drag track next to Smash.
 * One full swipe across the bar = one full Y spin (2π).
 * Fill + thumb show how far through the current spin you are.
 */
export default function RotateBar({ rotationY = 0, onRotateDelta }) {
  const trackRef = useRef(null);
  // null = not dragging; otherwise last pointer X in viewport pixels.
  const lastXRef = useRef(null);

  const progress = spinProgress(rotationY);
  const percent = Math.round(progress * 100);

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    lastXRef.current = e.clientX;
  }

  function handlePointerMove(e) {
    if (lastXRef.current == null || !trackRef.current) return;

    const width = trackRef.current.offsetWidth;
    if (width <= 0) return;

    const deltaX = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;

    onRotateDelta((deltaX / width) * TWO_PI);
  }

  function endDrag() {
    lastXRef.current = null;
  }

  return (
    <div
      ref={trackRef}
      className="rotate-bar"
      role="slider"
      aria-label="Rotate apple"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="rotate-bar__fill"
        style={{ width: `${progress * 100}%` }}
      />
      <div
        className="rotate-bar__thumb"
        style={{ left: `${progress * 100}%` }}
      />
    </div>
  );
}
