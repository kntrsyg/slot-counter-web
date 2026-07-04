import { sampleMachine } from '../data/sample'
import type { PlaySession, SlotMachine } from '../types'

const KEYS = {
  machines: 'slot-counter:machines:v1',
  sessions: 'slot-counter:sessions:v1',
  activeSession: 'slot-counter:active-session:v1',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export const storage = {
  getMachines(): SlotMachine[] {
    const machines = read<SlotMachine[]>(KEYS.machines, [])
    if (machines.length) return machines
    write(KEYS.machines, [sampleMachine])
    return [sampleMachine]
  },
  saveMachines(machines: SlotMachine[]): void {
    write(KEYS.machines, machines)
  },
  getSessions(): PlaySession[] {
    return read<PlaySession[]>(KEYS.sessions, [])
  },
  saveSessions(sessions: PlaySession[]): void {
    write(KEYS.sessions, sessions)
  },
  getActiveSession(): PlaySession | null {
    return read<PlaySession | null>(KEYS.activeSession, null)
  },
  saveActiveSession(session: PlaySession): void {
    write(KEYS.activeSession, session)
  },
  clearActiveSession(): void {
    localStorage.removeItem(KEYS.activeSession)
  },
}
