export default function SmashButton({ status, onSmash }) {
  const disabled = status !== "idle";

  return (
    <button
      type="button"
      className={`smash-btn${disabled ? " smash-btn--disabled" : ""}`}
      onClick={onSmash}
      disabled={disabled}
      aria-disabled={disabled}
    >
      smash
    </button>
  );
}
