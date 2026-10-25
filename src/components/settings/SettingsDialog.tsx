import {useEffect, useRef, useState} from 'react'
import {BackIcon, ChevronRightIcon, CloseIcon, GearIcon} from './icons'
import {SETTINGS} from './registry'
import './settings.css'

export function SettingsDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [viewId, setViewId] = useState<string | null>(null)

  const current = SETTINGS.find(s => s.id === viewId)

  const open = () => dialogRef.current?.showModal()
  const close = () => dialogRef.current?.close()

  // Move focus to the title when drilling in or back, so screen readers
  // announce the new view. (No-op while the dialog is closed.)
  useEffect(() => {
    titleRef.current?.focus()
  }, [viewId])

  return (
    <>
      <button
        type="button"
        className="settings-trigger"
        aria-label="Settings"
        aria-haspopup="dialog"
        onClick={open}>
        <GearIcon />
      </button>

      <dialog
        ref={dialogRef}
        className="settings"
        aria-labelledby="settings-title"
        onClose={() => setViewId(null)}
        // A click on the backdrop lands on the <dialog> element itself.
        onClick={e => {
          if (e.target === e.currentTarget) close()
        }}>
        <div className="settings__panel">
          <header className="settings__header">
            {current && (
              <button
                type="button"
                className="icon-btn settings__back"
                aria-label="Back to settings"
                onClick={() => setViewId(null)}>
                <BackIcon />
              </button>
            )}
            <h2
              id="settings-title"
              className="settings__title"
              ref={titleRef}
              tabIndex={-1}>
              {current ? current.label : 'Settings'}
            </h2>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close settings"
              onClick={close}>
              <CloseIcon />
            </button>
          </header>

          <div className="settings__body">
            {current ? (
              <current.Detail />
            ) : (
              <ul className="settings__list">
                {SETTINGS.map(s => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="settings-row"
                      onClick={() => setViewId(s.id)}>
                      <span className="settings-row__label">{s.label}</span>
                      <span className="settings-row__value">
                        <s.Summary />
                      </span>
                      <ChevronRightIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}