import {createContext, useContext, useState, type ReactNode} from 'react'
import {CLIENTS, getClient, setClient as persist, type Client} from './clients'

type Ctx = {client: Client; select: (id: string) => void}

const ClientContext = createContext<Ctx | null>(null)

export function ClientProvider({children}: {children: ReactNode}) {
  const [client, setCurrent] = useState<Client>(getClient)

  const select = (id: string) => {
    const next = CLIENTS.find(c => c.id === id)
    if (!next) return
    persist(id)
    setCurrent(next)
  }

  return (
    <ClientContext.Provider value={{client, select}}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClient must be used inside <ClientProvider>')
  return ctx
}

export function ClientLink({
  path,
  children,
}: {
  path: string
  children: ReactNode
}) {
  const {client} = useClient()
  return (
    <a href={client.origin + path} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}
