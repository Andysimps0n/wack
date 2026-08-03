import { useEffect, useState } from "react";

// Returns how far the page is scrolled, normalized to a 0-1 range.
// 0 = top of the page, 1 = scrolled all the way to the bottom.
export default function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maxScroll > 0 ? window.scrollY / maxScroll : 0);
    }

    // Prevent the browser from restoring scroll position on refresh, and
    // start at the top so the crush begins uncompressed.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return progress;
}
