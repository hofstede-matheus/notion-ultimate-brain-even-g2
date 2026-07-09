export interface Config {
  port: number
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT) || 3210,
  }
}

export const config = loadConfig()
