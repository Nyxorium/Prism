import {useEffect, useRef, useState} from 'react'
import {CLIENTS} from '../lib/clients'
import {useClient} from '../lib/ClientContext'

export function ClientPicker() {
  const {client: current, select} = useClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  return (
    <div ref={ref} className="client-picker">
      <button
        type="button"
        className="client-picker__trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open links in ${current.name}`}
        title={`Open links in ${current.name}`}>
        <img className="client-picker__icon" src={current.icon} alt="" />
        <span>{current.name}</span>
        <svg
          className="client-picker__chevron"
          viewBox="0 0 10 10"
          aria-hidden="true">
          <path
            d="M1.5 6.5 5 3l3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul role="menu" className="client-picker__menu">
          <li role="presentation" className="client-picker__label">
            Open links in
          </li>
          {CLIENTS.map(c => (
            <li key={c.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={c.id === current.id}
                className="client-picker__item"
                onClick={() => {
                  select(c.id)
                  setOpen(false)
                }}>
                <img className="client-picker__icon" src={c.icon} alt="" />
                {c.name}
                <span className="client-picker__check" aria-hidden="true">
                  ✓
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
