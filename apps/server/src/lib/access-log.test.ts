import { describe, expect, it } from 'vitest'
import { accessLogLevel } from './access-log.js'

const id = '0b7a1f9e-5c34-4a8e-9b1d-2f6c7e8a9b10'

describe('access log level', () => {
  it('keeps the polled screens at debug', () => {
    for (const path of [
      '/api/auth/me',
      '/api/stellar/credentials',
      `/api/syncs/${id}`,
      `/api/pocs/${id}`,
      `/api/pocs/${id}/notebook`,
      `/api/pocs/${id}/experiences`,
      `/api/pocs/${id}/experiences/${id}`,
      '/api/admin/audit/logs',
    ])
      expect(accessLogLevel('GET', path, 200), path).toBe('debug')
    // The Presenter's hover and scroll arrive several times a second.
    expect(accessLogLevel('POST', `/api/pocs/${id}/experiences/${id}/view`, 200)).toBe('debug')
  })

  it('keeps every action and every other read at info', () => {
    expect(accessLogLevel('POST', `/api/pocs/${id}/syncs`, 202)).toBe('info')
    expect(accessLogLevel('PATCH', `/api/pocs/${id}/experiences/${id}`, 200)).toBe('info')
    expect(accessLogLevel('POST', `/api/pocs/${id}/experiences/${id}/go`, 200)).toBe('info')
    expect(accessLogLevel('GET', '/api/pocs', 200)).toBe('info')
    expect(accessLogLevel('GET', `/api/report-data/${id}/pdf`, 200)).toBe('info')
    expect(accessLogLevel('GET', `/api/pocs/${id}/arch-image`, 200)).toBe('info')
  })

  it('never hides a failure, polled or not', () => {
    expect(accessLogLevel('GET', `/api/pocs/${id}/experiences/${id}`, 404)).toBe('warn')
    expect(accessLogLevel('POST', `/api/pocs/${id}/experiences/${id}/view`, 409)).toBe('warn')
    expect(accessLogLevel('GET', `/api/pocs/${id}/notebook`, 500)).toBe('error')
  })
})
