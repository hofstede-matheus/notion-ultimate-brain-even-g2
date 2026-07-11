import { describe, it, expect, afterEach } from 'vitest'
import { loadConfig } from '../config'

const originalPort = process.env.PORT

afterEach(() => {
  if (originalPort === undefined) delete process.env.PORT
  else process.env.PORT = originalPort
})

describe('loadConfig', () => {
  it('defaults the port to 3210 when PORT is unset', () => {
    delete process.env.PORT
    expect(loadConfig().port).toBe(3210)
  })

  it('parses PORT from the environment', () => {
    process.env.PORT = '8080'
    expect(loadConfig().port).toBe(8080)
  })

  it('falls back to 3210 when PORT is not a number', () => {
    process.env.PORT = 'not-a-number'
    expect(loadConfig().port).toBe(3210)
  })
})
