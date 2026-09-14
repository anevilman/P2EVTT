import { useCallback, useState } from "react";
import { applyTheme, loadTheme, toggleTheme, type Theme } from "./theme";

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = loadTheme();
    applyTheme(initial);
    return initial;
  });

  const toggle = useCallback(() => {
    setTheme((current) => toggleTheme(current));
  }, []);

  return { theme, toggle };
}
