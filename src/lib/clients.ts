export type Client = {
  id: string
  name: string
  icon: string
  origin: string
}

export const CLIENTS: Client[] = [
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: '/clients/bluesky.png',
    origin: 'https://bsky.app',
  },
  {
    id: 'deer-social',
    name: 'Deer Social',
    icon: '/clients/deer-social.png',
    origin: 'https://deer.social',
  },
  {
    id: 'mu-social',
    name: 'mu Social',
    icon: '/clients/mu-social.png',
    origin: 'https://mu.social',
  },
  {
    id: 'nyxo-sky',
    name: 'Nyxo Sky',
    icon: '/clients/nyxo-sky/icon.png',
    origin: 'https://nyxosky.pages.dev',
  },
  {
    id: 'witchsky',
    name: 'Witchsky',
    icon: '/clients/witchsky.png',
    origin: 'https://witchsky.app',
  },
]

const KEY = 'pridelabeller:client'

export function getClient(): Client {
  try {
    const id = localStorage.getItem(KEY)
    return CLIENTS.find(c => c.id === id) ?? CLIENTS[0]
  } catch {
    return CLIENTS[0]
  }
}

export function setClient(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {}
}
