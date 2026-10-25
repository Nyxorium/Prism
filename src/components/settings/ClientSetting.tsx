import {CLIENTS} from '../../lib/clients'
import {useClient} from '../../lib/ClientContext'
import {CheckIcon} from './icons'

/** Current value shown on the settings list row. */
export function ClientSummary() {
  const {client} = useClient()
  return (
    <>
      <img className="option-row__icon" src={client.icon} alt="" />
      {client.name}
    </>
  )
}

export function ClientDetail() {
  const {client: current, select} = useClient()
  return (
    <>
      <p className="settings-hint">
        Links to profiles and settings open in this client.
      </p>
      <div className="option-list">
        {CLIENTS.map(c => {
          const active = c.id === current.id
          return (
            <button
              key={c.id}
              type="button"
              className="option-row"
              aria-current={active ? 'true' : undefined}
              onClick={() => select(c.id)}>
              <img className="option-row__icon" src={c.icon} alt="" />
              {c.name}
              {active && <CheckIcon />}
            </button>
          )
        })}
      </div>
    </>
  )
}