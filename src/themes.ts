export interface ThemeDef {
  id: string;
  label: string;
  swatch: string;
}

export const THEMES: ThemeDef[] = [
  { id: "indigo", label: "Indigo", swatch: "#8c7ffb" },
  { id: "violet", label: "Violet", swatch: "#c084fc" },
  { id: "wine", label: "Wine", swatch: "#e6a15c" },
  { id: "sky", label: "Sky", swatch: "#5bcefa" },
];

export const DEFAULT_THEME = "indigo";