import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'

const ISSUER = 'Stellar Cyber POV Intelligence Portal'

export function newTotpSecret(): string {
  return generateSecret()
}

export async function totpEnrolment(secret: string, email: string): Promise<{ uri: string; qrDataUrl: string }> {
  const uri = generateURI({ issuer: ISSUER, label: email, secret })
  return { uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) }
}

/**
 * Accepts the current code ±30 s. Returns the matched time step so the caller can store it:
 * passing it back as `afterTimeStep` rejects a replay of the same code.
 */
export async function checkTotp(secret: string, code: string, afterTimeStep?: number | null): Promise<number | null> {
  const result = await verify({
    secret,
    token: code,
    epochTolerance: 30,
    ...(afterTimeStep != null ? { afterTimeStep } : {}),
  })
  // The result type also covers HOTP; a TOTP match always carries timeStep.
  return result.valid && 'timeStep' in result ? result.timeStep : null
}

/** Additional data binding a sealed TOTP secret to its User (users.mfa_secret_enc). */
export const mfaAad = (userId: string) => `mfa:${userId}`
