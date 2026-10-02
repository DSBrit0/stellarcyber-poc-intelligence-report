import { randomBytes } from 'node:crypto'

// Access Keys are read aloud or typed from a slide: 12 characters from an alphabet without look-alikes
// (no 0/O, 1/I/L), grouped as XXXX-XXXX-XXXX. ~59 bits of entropy, and useless without approval.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newAccessKey(): string {
  const bytes = randomBytes(12)
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`
}

/** Case and separators do not matter when the key is typed back. */
export const normalizeAccessKey = (key: string) => key.toUpperCase().replace(/[^A-Z0-9]/g, '')
