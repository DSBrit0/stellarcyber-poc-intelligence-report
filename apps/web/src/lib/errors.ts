import type { MessageKey } from '@poc-intel/shared/i18n'
import { ApiError } from './api'

const KNOWN: Record<string, MessageKey> = {
  invalid_credentials: 'auth.invalid',
  pending: 'auth.pending',
  locked: 'auth.locked',
  invalid_code: 'mfa.invalid',
  password_unchanged: 'password.unchanged',
  customer_key_invalid: 'auth.customerKeyInvalid',
  report_data_outdated: 'report.outdated',
}

export function errorKey(err: unknown): MessageKey {
  return (err instanceof ApiError && KNOWN[err.code]) || 'common.error'
}
