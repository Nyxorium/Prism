import { useEffect, useRef, useState } from "react";
import { THEMES } from "./themes";
import { useTheme } from "./useTheme";

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="theme-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="theme-swatch" style={{ background: active.swatch }} />
        <span>{active.label.replace(" (default)", "")}</span>
        <ChevronIcon />
      </button>

      {open && (
        <ul className="theme-menu" role="listbox" aria-label="Color theme">
          {THEMES.map((t) => {
            const isActive = t.id === theme;
            return (
              <li
                key={t.id}
                role="option"
                aria-selected={isActive}
                className={`theme-option${isActive ? " theme-option--active" : ""}`}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
              >
                <span className="theme-swatch" style={{ background: t.swatch }} />
                <span>{t.label}</span>
                {isActive && <CheckIcon />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}