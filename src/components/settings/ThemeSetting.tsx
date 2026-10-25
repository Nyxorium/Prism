import {THEMES} from '../../themes'
import {useTheme} from '../../useTheme'
import {CheckIcon} from './icons'

const DEFAULT_SUFFIX = ' (default)'
const themeName = (label: string) => label.replace(DEFAULT_SUFFIX, '')
const isDefault = (label: string) => label.includes(DEFAULT_SUFFIX)

/** Current value shown on the settings list row. */
export function ThemeSummary() {
  const {theme} = useTheme()
  const active = THEMES.find(t => t.id === theme) ?? THEMES[0]
  return (
    <>
      <span className="swatch" style={{background: active.swatch}} />
      {themeName(active.label)}
    </>
  )
}

/** Swatch grid. Each preview sets its own data-theme, so it renders with the
    real theme variables instead of hardcoded colours. */
export function ThemeDetail() {
  const {theme, setTheme} = useTheme()
  return (
    <>
      <p className="settings-hint">Pick a color theme.</p>
      <div className="theme-grid">
        {THEMES.map(t => {
          const active = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              className="theme-card"
              aria-current={active ? 'true' : undefined}
              onClick={() => setTheme(t.id)}>
              <span className="theme-card__preview" data-theme={t.id}>
                <span className="theme-card__panel">
                  <span className="theme-card__line" />
                  <span className="theme-card__chip" />
                </span>
              </span>
              <span className="theme-card__meta">
                {themeName(t.label)}
                {isDefault(t.label) && (
                  <span className="theme-card__tag">Default</span>
                )}
                {active && <CheckIcon />}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}