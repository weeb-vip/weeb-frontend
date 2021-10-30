import { IConfig } from './interfaces'

// @ts-ignore
const { config } = global

export function getConfig(): IConfig {
  return config
}

export default config
