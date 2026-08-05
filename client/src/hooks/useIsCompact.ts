import { useEffect, useState } from "react";

/**
 * Matches the width of a typical phone held in portrait — comfortably above
 * the widest common phones (~430px) and well below where the session layout
 * switches to a stacked single column (860px), so it only fires for genuinely
 * narrow screens.
 */
const COMPACT_QUERY = "(max-width: 480px)";

/**
 * The wheel's SVG text is sized in viewBox units, so it shrinks along with
 * the wheel's rendered width on narrow screens — legible on desktop, too
 * small to read comfortably on a phone. Components use this to switch to
 * larger viewBox-unit font sizes that land back at a readable pixel size.
 */
export function useIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsCompact(event.matches);

    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isCompact;
}
