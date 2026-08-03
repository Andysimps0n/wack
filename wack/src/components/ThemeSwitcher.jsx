export default function ThemeSwitcher({ theme, onThemeChange }) {
  return (
    <div className="theme-switcher">
      <button
        type="button"
        className={`theme-btn ${theme === "apple" ? "theme-btn--active" : ""}`}
        onClick={() => onThemeChange("apple")}
      >
        apple
      </button>
      <button
        type="button"
        className={`theme-btn ${theme === "butter" ? "theme-btn--active" : ""}`}
        onClick={() => onThemeChange("butter")}
      >
        butter
      </button>
    </div>
  );
}
