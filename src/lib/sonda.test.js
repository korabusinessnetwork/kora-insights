import { describe, expect, it, vi } from 'vitest'

describe('sonda', () => {
  it('stubEnv em DEV', () => {
    console.log('antes', import.meta.env.DEV, typeof import.meta.env.DEV)
    vi.stubEnv('DEV', false)
    console.log('depois', import.meta.env.DEV, typeof import.meta.env.DEV)
    vi.unstubAllEnvs()
    console.log('restaurado', import.meta.env.DEV)
    console.log('crypto', typeof crypto?.getRandomValues, 'storage', typeof sessionStorage, 'origin', globalThis.location?.origin)
    expect(true).toBe(true)
  })
})
