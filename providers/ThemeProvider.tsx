"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "ocean" | "space" | "forest" | "candy" | "classic";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: "nunito" | "opendyslexic";
  setFontFamily: (family: "nunito" | "opendyslexic") => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "ocean",
  setTheme: () => {},
  fontSize: 20,
  setFontSize: () => {},
  fontFamily: "nunito",
  setFontFamily: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("ocean");
  const [fontSize, setFontSizeState] = useState(20);
  const [fontFamily, setFontFamilyState] = useState<"nunito" | "opendyslexic">("nunito");

  useEffect(() => {
    const saved = localStorage.getItem("rar-theme") as Theme | null;
    const savedSize = localStorage.getItem("rar-font-size");
    const savedFont = localStorage.getItem("rar-font-family") as "nunito" | "opendyslexic" | null;
    if (saved) setThemeState(saved);
    if (savedSize) setFontSizeState(parseInt(savedSize));
    if (savedFont) setFontFamilyState(savedFont);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("rar-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  const setFontSize = (size: number) => {
    setFontSizeState(size);
    localStorage.setItem("rar-font-size", String(size));
    document.documentElement.style.setProperty("--word-size", `${size}px`);
  };

  const setFontFamily = (family: "nunito" | "opendyslexic") => {
    setFontFamilyState(family);
    localStorage.setItem("rar-font-family", family);
    if (family === "opendyslexic") {
      document.documentElement.classList.add("font-opendyslexic");
    } else {
      document.documentElement.classList.remove("font-opendyslexic");
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--word-size", `${fontSize}px`);
    if (fontFamily === "opendyslexic") {
      document.documentElement.classList.add("font-opendyslexic");
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontSize, setFontSize, fontFamily, setFontFamily }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
