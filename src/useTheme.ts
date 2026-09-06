import { useEffect, useState } from "react";
import { DEFAULT_THEME } from "./themes";

const STORAGE_KEY = "pridelabeller:theme";

export function useTheme() {
  const [theme, setThemeState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME,
  );

  useEffect(() => {
    if (theme === DEFAULT_THEME) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  function setTheme(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setThemeState(id);
  }

  return { theme, setTheme };
}
