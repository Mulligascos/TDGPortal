import { useState, useEffect } from "react";

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", String(next));
  }

  return { darkMode, toggleDark };
}
