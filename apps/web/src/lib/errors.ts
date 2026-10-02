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
  sync_in_progress: 'err.sync_in_progress',
  credential_required: 'err.credential_required',
  stellar_auth_failed: 'err.stellar_auth_failed',
  stellar_forbidden: 'err.stellar_forbidden',
  stellar_not_found: 'err.stellar_network',
  stellar_network: 'err.stellar_network',
  stellar_unavailable: 'err.stellar_unavailable',
  stellar_bad_response: 'err.stellar_unavailable',
  customer_exists: 'err.customer_exists',
  validation: 'err.validation',
}

/** A clear message for every error code the API sends; the generic one only for the unexpected. */
export function errorKey(err: unknown): MessageKey {
  return (err instanceof ApiError && KNOWN[err.code]) || 'common.error'
}
