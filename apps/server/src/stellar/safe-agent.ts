import dns from 'node:dns'
import net from 'node:net'
import { Agent } from 'undici'

// SSRF guard ported from the previous tool: an Instance URL is typed by a User, so the
// worker must never be steered into this server's own networks. The check runs at
// connect time (not only on the URL), which also defeats DNS rebinding.
const BLOCKED: [string, number, 'ipv4' | 'ipv6'][] = [
  ['0.0.0.0', 8, 'ipv4'], ['10.0.0.0', 8, 'ipv4'], ['100.64.0.0', 10, 'ipv4'], ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'], ['172.16.0.0', 12, 'ipv4'], ['192.0.0.0', 24, 'ipv4'], ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'], ['224.0.0.0', 4, 'ipv4'], ['240.0.0.0', 4, 'ipv4'],
  ['::', 128, 'ipv6'], ['::1', 128, 'ipv6'], ['fc00::', 7, 'ipv6'], ['fe80::', 10, 'ipv6'], ['ff00::', 8, 'ipv6'],
]

function toList(cidrs: string[]): net.BlockList {
  const list = new net.BlockList()
  for (const cidr of cidrs) {
    const [addr, prefix] = cidr.split('/')
    if (!addr || !prefix) throw new Error(`Invalid CIDR: ${cidr}`)
    list.addSubnet(addr, Number(prefix), net.isIPv6(addr) ? 'ipv6' : 'ipv4')
  }
  return list
}

export function createIpGuard(allowedPrivateCidrs: string[]): (ip: string) => boolean {
  const blocked = new net.BlockList()
  for (const [addr, prefix, family] of BLOCKED) blocked.addSubnet(addr, prefix, family)
  const allowed = toList(allowedPrivateCidrs)
  return (rawIp) => {
    const ip = rawIp.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] ?? rawIp
    const family = net.isIPv6(ip) ? 'ipv6' : 'ipv4'
    return !blocked.check(ip, family) || allowed.check(ip, family)
  }
}

export class BlockedAddressError extends Error {
  readonly code = 'EBLOCKED'
}

export function createSafeAgent(allowedPrivateCidrs: string[]): Agent {
  const isAllowed = createIpGuard(allowedPrivateCidrs)
  const lookup: net.LookupFunction = (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0)
      const list = addresses as dns.LookupAddress[]
      const bad = list.find((a) => !isAllowed(a.address))
      if (bad) return callback(new BlockedAddressError(`Instance resolves to a blocked address (${bad.address})`), '', 0)
      if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list)
      const first = list[0]!
      callback(null, first.address, first.family)
    })
  }
  // One pooled, keep-alive agent per process: the Sync makes hundreds of calls to the same host.
  return new Agent({ connect: { lookup, timeout: 15_000 }, connections: 16, keepAliveTimeout: 30_000, allowH2: true })
}
