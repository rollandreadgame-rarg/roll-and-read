"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setMasterVolume, setMuted } from "@/lib/audio/soundManager";

type Theme = "ocean" | "space" | "forest" | "candy" | "classic";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: "nunito" | "opendyslexic";
  setFontFamily: (family: "nunito" | "opendyslexic") => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
  soundVolume: number; // 0..1
  setSoundVolume: (vol: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "ocean",
  setTheme: () => {},
  fontSize: 20,
  setFontSize: () => {},
  fontFamily: "nunito",
  setFontFamily: () => {},
  soundMuted: false,
  setSoundMuted: () => {},
  soundVolume: 0.7,
  setSoundVolume: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("ocean");
  const [fontSize, setFontSizeState] = useState(20);
  const [fontFamily, setFontFamilyState] = useState<"nunito" | "opendyslexic">("nunito");
  const [soundMuted, setSoundMutedState] = useState(false);
  const [soundVolume, setSoundVolumeState] = useState(0.7);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem("rar-theme") as Theme | null;
    const savedSize = localStorage.getItem("rar-font-size");
    const savedFont = localStorage.getItem("rar-font-family") as "nunito" | "opendyslexic" | null;
    const savedMuted = localStorage.getItem("rar-sound-muted");
    const savedVolume = localStorage.getItem("rar-sound-volume");
    if (saved) setThemeState(saved);
    if (savedSize) setFontSizeState(parseInt(savedSize));
    if (savedFont) setFontFamilyState(savedFont);
    if (savedMuted !== null) setSoundMutedState(savedMuted === "true");
    if (savedVolume !== null) {
      const v = parseFloat(savedVolume);
      if (!isNaN(v)) setSoundVolumeState(v);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const setSoundMuted = (muted: boolean) => {
    setSoundMutedState(muted);
    localStorage.setItem("rar-sound-muted", String(muted));
    setMuted(muted);
  };

  const setSoundVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setSoundVolumeState(clamped);
    localStorage.setItem("rar-sound-volume", String(clamped));
    setMasterVolume(clamped);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--word-size", `${fontSize}px`);
    if (fontFamily === "opendyslexic") {
      document.documentElement.classList.add("font-opendyslexic");
    } else {
      document.documentElement.classList.remove("font-opendyslexic");
    }
    setMasterVolume(soundVolume);
    setMuted(soundMuted);
  }, [theme, fontSize, fontFamily, soundVolume, soundMuted]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        fontSize,
        setFontSize,
        fontFamily,
        setFontFamily,
        soundMuted,
        setSoundMuted,
        soundVolume,
        setSoundVolume,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
