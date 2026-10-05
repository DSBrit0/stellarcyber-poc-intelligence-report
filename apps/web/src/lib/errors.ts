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
  sync_not_running: 'err.sync_not_running',
  credential_required: 'err.credential_required',
  period_future: 'err.period_future',
  stellar_auth_failed: 'err.stellar_auth_failed',
  stellar_forbidden: 'err.stellar_forbidden',
  stellar_not_found: 'err.stellar_network',
  stellar_network: 'err.stellar_network',
  stellar_unavailable: 'err.stellar_unavailable',
  stellar_bad_response: 'err.stellar_unavailable',
  customer_exists: 'err.customer_exists',
  company_users_own_records: 'err.company_users_own_records',
  customer_is_partner: 'err.customer_is_partner',
  customer_not_yours: 'err.customer_not_yours',
  report_target_missing: 'err.report_target_missing',
  report_target_set: 'err.report_target_set',
  cannot_delete_self: 'err.cannot_delete_self',
  last_admin: 'err.last_admin',
  transfer_required: 'err.transfer_required',
  transfer_invalid: 'err.transfer_invalid',
  confirm_name: 'err.confirm_name',
  catalog_host: 'err.catalog_host',
  catalog_unreachable: 'err.catalog_unreachable',
  catalog_version_unknown: 'err.catalog_version_unknown',
  catalog_version_mismatch: 'err.catalog_version_mismatch',
  catalog_no_parsers: 'err.catalog_no_parsers',
  catalog_no_connectors: 'err.catalog_no_connectors',
  validation: 'err.validation',
}

/**
 * A clear message for every error code the API sends; the generic one only for the unexpected.
 * `overrides` words a code for one action (e.g. sync_in_progress when deleting a PoC).
 */
export function errorKey(err: unknown, overrides: Record<string, MessageKey> = {}): MessageKey {
  return (err instanceof ApiError && (overrides[err.code] ?? KNOWN[err.code])) || 'common.error'
}
