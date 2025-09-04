/**
 * Application Version Configuration
 * This file is automatically updated by the semantic versioning workflow
 */

export const VERSION = '0.0.5'

export const VERSION_INFO = {
  version: VERSION,
  buildDate: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
} as const

export function getVersionDisplay(): string {
  return `v${VERSION}`
}

export function getFullVersionInfo(): string {
  return `v${VERSION} (${VERSION_INFO.environment})`
}
