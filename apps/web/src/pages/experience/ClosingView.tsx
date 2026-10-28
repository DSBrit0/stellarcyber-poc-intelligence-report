import { useState } from 'react'
import { useWords } from './content'
import type { ExperienceWords } from './content/types'
import { Spot } from './spotlight'

/**
 * The Closing's two diagrams, in place of the 3D Stack: how Stellar Cyber is deployed (topology) and
 * the lab the Customer is invited to (Lab presentation, slides 1–4). Every device can be put in the
 * Spotlight, so the Presenter points and everyone follows.
 */
export interface Participant {
  userId: string
  name: string
  /** Shown to whoever runs the session, and to each participant for their own row. */
  email: string | null
  customer: boolean
  /** Seen in the last 30 s. */
  online: boolean
  /** Online but not looking: page hidden, window out of focus or pointer off the page. */
  away: boolean
  /** The runner leading the session: left out of the names above the Stack. */
  presenter: boolean
  labConfirmed: boolean
  mine: boolean
}

/** Centred in the space below the title: the Closing has no side panel. */
export function ClosingView({
  stage,
  participants,
  canRun,
  live,
  onLabAccess,
}: {
  stage: 'topology' | 'lab'
  participants: Participant[]
  canRun: boolean
  live: boolean
  onLabAccess: (confirmed: boolean) => Promise<unknown>
}) {
  return (
    <div className="pointer-events-auto mt-5 flex min-h-0 flex-1 items-center justify-center">
      {stage === 'topology' ? <TopologyView /> : <LabView participants={participants} canRun={canRun} live={live} onLabAccess={onLabAccess} />}
    </div>
  )
}

/** Brand colours of the Stack's layers (StackScene), and the attack's. */
const RED = '#E03A26'
const ORANGE = '#FF9B1D'
const BLUE = '#2059E0'
const PURPLE = '#9320E0'
const BURNT = '#F05B2A'
const GRAY = '#8FA3B8'
const ATTACKER = '#E040FB'

/** A point on a drawing's 1000 × 500 grid. */
type XY = [number, number]

/** Device drawings, line art on a 48 × 48 grid. */
const DEVICE = {
  firewall: 'M6 12h36v24H6zM6 20h36M6 28h36M18 12v8M30 12v8M12 20v8M24 20v8M36 20v8M18 28v8M30 28v8',
  switch: 'M4 18h40v12H4zM10 24h2M16 24h2M22 24h2M28 24h2M34 24h2M8 30v4M40 30v4',
  virtual: 'M6 10h22v16H6zM20 22h22v16H20zM10 30v4h6M26 14h4v4',
  servers: 'M12 6h24v11H12zM12 19h24v11H12zM12 32h24v11H12zM17 11.5h2M17 24.5h2M17 37.5h2M26 11.5h6M26 24.5h6M26 37.5h6',
  server: 'M12 8h24v32H12zM12 18h24M12 28h24M17 13h2M17 23h2M17 33h2M27 13h4M27 23h4M27 33h4',
  pc: 'M7 9h34v22H7zM24 31v7M15 38h18',
  mac: 'M11 11h26v18H11zM5 33h38l-3 4H8z',
  sensor: 'M5 16h38v16H5zM10 24h2M15 24h2M21 21c2 2 2 4 0 6M25 19c3.5 3 3.5 7 0 10M29 17c5 4 5 10 0 14M36 22v4',
  cloud: 'M14 34h22a8 8 0 0 0 0-16 11 11 0 0 0-21-3 9 9 0 0 0-1 19z',
  attacker: 'M18 16a6 6 0 0 1 12 0v10a6 6 0 0 1-12 0zM24 16v16M10 20h8M30 20h8M10 28h8M30 28h8M14 10l4 4M34 10l-4 4M12 36l6-4M36 36l-6-4',
}

/**
 * One link: a gentle curve between two points, with records gliding along it (`back`: against the
 * arrow). Its label sits on the curve's middle, or at `labelAt` where that would cover a device's name.
 */
function Link({
  a,
  b,
  color,
  label,
  labelAt,
  bend = 0,
  dashed = false,
  back = false,
  still = false,
  strong = false,
}: {
  a: XY
  b: XY
  color: string
  label?: string
  labelAt?: XY
  bend?: number
  dashed?: boolean
  back?: boolean
  /** A plain wire, nothing flowing (the lab's LAN cabling). */
  still?: boolean
  /** The attack's own links, drawn heavier. */
  strong?: boolean
}) {
  const [x1, y1] = a
  const [x2, y2] = b
  const mx = (x1 + x2) / 2 + bend * (y2 - y1) * 0.25
  const my = (y1 + y2) / 2 - bend * (x2 - x1) * 0.25
  const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeOpacity={strong ? 0.55 : 0.35} strokeWidth={strong ? 2.6 : dashed ? 1.4 : 2} strokeDasharray={dashed ? '5 6' : undefined} />
      {still ? null : (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strong ? 3.2 : 2.4}
          strokeLinecap="round"
          strokeDasharray="2 26"
          className={back ? 'motion-safe:animate-[link-flow-back_1.4s_linear_infinite]' : 'motion-safe:animate-[link-flow_1.4s_linear_infinite]'}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      )}
      {label ? (
        <text
          x={labelAt?.[0] ?? (x1 + 2 * mx + x2) / 4}
          y={labelAt?.[1] ?? (y1 + 2 * my + y2) / 4 - 7}
          textAnchor={labelAt ? 'start' : 'middle'}
          // A halo of the ground's colour keeps the label legible where other links cross it.
          stroke="#0A1823"
          strokeWidth={4}
          strokeLinejoin="round"
          paintOrder="stroke"
          className="fill-sc-silver/70 font-roboto text-[11px]"
        >
          {label}
        </text>
      ) : null}
    </g>
  )
}

/** A numbered step of the attack, on its link. */
function StepBadge({ at, n }: { at: XY; n: string }) {
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={n.length > 1 ? 15 : 11} fill="#0A1823" stroke={BURNT} strokeWidth={2} />
      <text x={at[0]} y={at[1] + 4} textAnchor="middle" className="fill-sc-silver font-roboto text-[11px] font-bold">
        {n}
      </text>
    </g>
  )
}

/** A device on a drawing: its line art in a glowing tile, its name below; it can be put in the Spotlight. */
function Device({ spot, at, kind, label, note, tone, size = 56, alert = false }: { spot: string; at: XY; kind: keyof typeof DEVICE; label: string; note?: string; tone: string; size?: number; alert?: boolean }) {
  return (
    // Centred on its point by `transform` alone: a Tailwind translate class would add a second shift.
    <div className="absolute text-center" style={{ left: `${at[0] / 10}%`, top: `${at[1] / 5}%`, transform: `translate(-50%, -${size / 2 + 4}px)` }}>
      <Spot id={spot} className="flex flex-col items-center gap-1 p-1">
        <span
          className="flex items-center justify-center rounded-xl border bg-[#060f17]/90"
          style={{
            width: size,
            height: size,
            borderColor: alert ? BURNT : `${tone}88`,
            boxShadow: alert ? `0 0 22px -2px ${BURNT}` : `0 0 18px -4px ${tone}, inset 0 0 12px -6px ${tone}`,
          }}
        >
          <svg viewBox="0 0 48 48" width={size * 0.66} height={size * 0.66} fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={DEVICE[kind]} />
          </svg>
        </span>
        <span className="max-w-[9rem] text-[11px] leading-tight font-medium text-sc-silver/90">{label}</span>
        {note ? <span className="max-w-[10rem] text-[10px] leading-tight text-sc-silver/50 tabular-nums">{note}</span> : null}
      </Spot>
    </div>
  )
}

/** The platform: the Multi-Layer AI Stack in miniature, its three layers in their colours under the purple cap. */
function Platform({ spot, at, label, note = 'Multi-Layer AI™' }: { spot: string; at: XY; label: string; note?: string }) {
  return (
    <div className="absolute text-center" style={{ left: `${at[0] / 10}%`, top: `${at[1] / 5}%`, transform: 'translate(-50%, -48px)' }}>
      <Spot id={spot} className="flex flex-col items-center gap-1 p-1">
        <span className="flex h-[88px] w-[104px] flex-col items-center justify-center gap-1 rounded-2xl border border-[#9320E0]/70 bg-[#0A1823]/90 shadow-[0_0_34px_-6px_#9320E0]">
          <span className="h-2 w-14 rounded-sm bg-[#9320E0]" />
          {[BLUE, ORANGE, RED].map((c) => (
            <span key={c} className="h-2.5 w-[4.5rem] rounded-sm" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
          ))}
        </span>
        <span className="text-xs font-semibold text-sc-silver">{label}</span>
        <span className="text-[10px] text-sc-silver/55">{note}</span>
      </Spot>
    </div>
  )
}

/** The topology's devices on the 1000 × 500 grid. */
const T: Record<string, XY> = {
  firewall: [110, 120],
  switch: [300, 120],
  pc: [225, 255],
  mac: [375, 255],
  virtual: [110, 395],
  servers: [300, 395],
  sensor: [560, 255],
  platform: [820, 395],
}
/** Cloud and SaaS tools reach the platform; on-premises ones (scanners, firewalls) go through a Connector on the sensor. */
// `name` is the tile's stable id (spotlight and layout); its label comes from the locale words by `key`.
const APIS: { name: string; key: keyof ExperienceWords['closing']['topology']['apis']; viaSensor: boolean }[] = [
  { name: 'Identity', key: 'identity', viaSensor: false },
  { name: 'EDR', key: 'edr', viaSensor: false },
  { name: 'PaaS', key: 'paas', viaSensor: false },
  { name: 'Vulnerability Mgmt.', key: 'vulnerability', viaSensor: true },
  { name: 'Firewalls', key: 'firewalls', viaSensor: true },
  { name: 'SaaS Apps', key: 'saas', viaSensor: false },
]
APIS.forEach((a, i) => (T[`api:${a.name}`] = [650 + (i % 3) * 130, 60 + Math.floor(i / 3) * 105]))

/**
 * Slide 1 as a network drawing: the Customer's environment feeds the Modular Sensor (span port,
 * syslog, virtual switch) and the Server Sensors; API integrations pull the tools, either straight
 * to the platform or through a Connector on the sensor; everything is normalized into Interflow on
 * its way to the platform, and responses run back to the environment.
 */
function TopologyView() {
  const w = useWords().closing.topology
  const n = w.nodes
  return (
    <div className="relative mx-auto aspect-[2/1] w-full max-w-[66rem] font-roboto">
      <svg viewBox="0 0 1000 500" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <rect x="20" y="40" width="460" height="440" rx="18" fill="#41C5F9" fillOpacity="0.03" stroke="#41C5F9" strokeOpacity="0.3" strokeDasharray="6 6" />
        <text x="40" y="66" className="fill-sc-silver/60 font-roboto text-[12px] font-semibold tracking-wide uppercase">
          {w.environment}
        </text>
        <text x="780" y="22" textAnchor="middle" className="fill-sc-solar/80 font-roboto text-[12px] font-semibold tracking-wide uppercase">
          {w.api}
        </text>
        <Link a={T.firewall!} b={T.switch!} color={GRAY} />
        <Link a={T.switch!} b={T.pc!} color={GRAY} />
        <Link a={T.switch!} b={T.mac!} color={GRAY} />
        <Link a={T.switch!} b={T.sensor!} color={RED} label={w.links.spanPort} bend={-0.4} />
        {/* Over the switch, clear of the PCs and Macs below it. */}
        <Link a={T.firewall!} b={T.sensor!} color={RED} label={w.links.syslog} bend={2} dashed />
        <Link a={T.virtual!} b={T.sensor!} color={RED} bend={0.5} />
        <Link a={T.servers!} b={T.platform!} color={BLUE} label={w.links.serverSensor} bend={0.15} />
        <Link a={T.sensor!} b={T.platform!} color={PURPLE} label={w.normalization} labelAt={[640, 300]} bend={-0.3} />
        {APIS.map((a) =>
          a.viaSensor ? (
            <Link key={a.name} a={T[`api:${a.name}`]!} b={T.sensor!} color={ORANGE} bend={-0.2} />
          ) : (
            <Link key={a.name} a={T[`api:${a.name}`]!} b={T.platform!} color={ORANGE} bend={0.1} />
          ),
        )}
        <text
          x="606"
          y="210"
          textAnchor="end"
          stroke="#0A1823"
          strokeWidth={4}
          strokeLinejoin="round"
          paintOrder="stroke"
          className="fill-sc-solar/90 font-roboto text-[11px]"
        >
          {w.links.connector}
        </text>
        <Link a={T.platform!} b={T.servers!} color={BURNT} label={w.response} bend={-0.55} dashed back />
      </svg>
      <Device spot="topo:firewall" at={T.firewall!} kind="firewall" label={n.firewall} tone={RED} />
      <Device spot="topo:switch" at={T.switch!} kind="switch" label={n.switch} tone={GRAY} />
      <Device spot="topo:pc" at={T.pc!} kind="pc" label={n.pc} tone={GRAY} size={48} />
      <Device spot="topo:mac" at={T.mac!} kind="mac" label={n.mac} tone={GRAY} size={48} />
      <Device spot="topo:virtual" at={T.virtual!} kind="virtual" label={n.virtual} tone={RED} />
      <Device spot="topo:servers" at={T.servers!} kind="servers" label={n.servers} note={w.links.serverSensor} tone={BLUE} />
      <Device spot="topo:sensor" at={T.sensor!} kind="sensor" label={w.sensor} note={w.sensorNote} tone={RED} size={64} />
      {APIS.map((a) => (
        <Device key={a.name} spot={`topo:api:${a.name}`} at={T[`api:${a.name}`]!} kind="cloud" label={w.apis[a.key]} tone={ORANGE} size={44} />
      ))}
      <Platform spot="topo:platform" at={T.platform!} label={w.platform} />
    </div>
  )
}

/** The lab's hosts (slide 2), on the drawing's grid: two rows hanging off the LAN. */
const HOSTS: { name: string; ip: string; kind: 'server' | 'pc'; at: XY }[] = [
  { name: 'santaclara', ip: '10.37.9.111', kind: 'server', at: [90, 225] },
  { name: 'redwoodcity', ip: '10.37.9.105', kind: 'pc', at: [230, 225] },
  { name: 'mountainview', ip: '10.37.9.104', kind: 'pc', at: [370, 225] },
  { name: 'losgatos', ip: '10.37.9.117', kind: 'server', at: [510, 225] },
  { name: 'redteam-dc', ip: '10.37.9.101 · AD', kind: 'server', at: [650, 225] },
  { name: 'ubuntu1804', ip: '10.37.9.109', kind: 'server', at: [160, 375] },
  { name: 'ubuntu2004', ip: '10.37.9.108', kind: 'server', at: [300, 375] },
  { name: 'sunnyvale', ip: '10.37.9.107', kind: 'server', at: [440, 375] },
  { name: 'sanjose', ip: '10.37.9.103', kind: 'server', at: [580, 375] },
]
const host = (name: string) => HOSTS.find((h) => h.name === name)!.at
const LAN_Y = 125
const L: Record<string, XY> = {
  firewall: [200, 45],
  sensor: [400, 45],
  platform: [895, 140],
  edr: [895, 345],
  caldera: [740, 440],
}
/** The Caldera chain (slide 3): each step's ATT&CK technique and where it lands. */
const STEPS: { target: string; technique: string }[] = [
  { target: '10.37.9.0/24', technique: 'T1046' },
  { target: 'redteam-dc', technique: 'T1110' },
  { target: 'losgatos', technique: 'T1003' },
  { target: 'losgatos', technique: 'T1490' },
  { target: 'losgatos', technique: 'T1082' },
  { target: 'sanjose', technique: 'T1021.002' },
  { target: 'sanjose', technique: 'T1570' },
  { target: 'sanjose', technique: 'T1490' },
]
const LAB_URL = 'https://coe.stellarcyber.cloud'
const ATTACKED = new Set(['losgatos', 'redteam-dc', 'sanjose'])

/**
 * Slides 2–4: the lab as a drawing of the interaction — Caldera drives the chain from losgatos (scan,
 * LDAP brute force on the AD, local steps, then SMB to sanjose); the sensor and SentinelOne feed the
 * platform, which answers by disabling the user in AD and isolating the host. Beside it, how to get in
 * and who is in the session.
 */
function LabView({ participants, canRun, live, onLabAccess }: { participants: Participant[]; canRun: boolean; live: boolean; onLabAccess: (confirmed: boolean) => Promise<unknown> }) {
  const w = useWords().closing.lab
  return (
    <div className="mx-auto grid w-full max-w-[92rem] items-center gap-6 font-roboto xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-3">
        <div className="relative mx-auto aspect-[2/1] w-full max-w-[58rem]">
          <svg viewBox="0 0 1000 500" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <rect x="20" y="95" width="760" height="355" rx="18" fill="#3FB950" fillOpacity="0.025" stroke="#3FB950" strokeOpacity="0.35" strokeDasharray="6 6" />
            <text x="40" y="117" className="fill-sc-silver/55 font-roboto text-[11px] font-semibold tracking-wide uppercase">
              {w.network} · 10.37.9.0/24
            </text>
            <line x1="40" y1={LAN_Y} x2="720" y2={LAN_Y} stroke="#41C5F9" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
            {HOSTS.map((h) => (
              <Link key={h.name} a={[h.at[0], LAN_Y]} b={h.at} color="#41C5F9" still />
            ))}
            <Link a={L.firewall!} b={[L.firewall![0], LAN_Y]} color="#41C5F9" still />
            <Link a={[L.sensor![0], LAN_Y]} b={L.sensor!} color={RED} label={w.sensorPort} labelAt={[410, 116]} dashed />
            <Link a={L.sensor!} b={L.platform!} color={PURPLE} label={w.links.logs} bend={-0.15} />
            <Link a={L.edr!} b={L.platform!} color={ORANGE} label={w.links.api} labelAt={[905, 290]} />
            {/* The attack, numbered as on slide 3. */}
            <Link a={L.caldera!} b={host('losgatos')} color={ATTACKER} label={w.links.caldera} dashed />
            <Link a={host('losgatos')} b={[440, LAN_Y]} color={BURNT} strong />
            {/* Arched over the hosts, under the LAN. */}
            <Link a={host('losgatos')} b={host('redteam-dc')} color={BURNT} bend={3.4} strong />
            <Link a={host('losgatos')} b={host('sanjose')} color={BURNT} strong />
            {/* The answer: disable the user in AD, isolate the host through SentinelOne. */}
            <Link a={L.platform!} b={host('redteam-dc')} color={ORANGE} label={w.disableUser} bend={0.25} dashed back />
            <Link a={L.edr!} b={host('sanjose')} color={ORANGE} label={w.isolateHost} bend={-0.2} dashed back />
            <StepBadge at={[475, 175]} n="1" />
            <StepBadge at={[580, 165]} n="2" />
            <StepBadge at={[458, 232]} n="3-5" />
            <StepBadge at={[545, 300]} n="6-8" />
          </svg>
          <Device spot="lab:firewall" at={L.firewall!} kind="firewall" label="SonicWall FW" note="10.37.8.1" tone={RED} size={44} />
          <Device spot="lab:sensor" at={L.sensor!} kind="sensor" label="Security Sensor" note="Log Forwarder · 10.37.9.112" tone={RED} size={44} />
          {HOSTS.map((h) => (
            <Device key={h.name} spot={`lab:host:${h.name}`} at={h.at} kind={h.kind} label={h.name} note={h.ip} tone="#41C5F9" size={40} alert={ATTACKED.has(h.name)} />
          ))}
          <Device spot="lab:edr" at={L.edr!} kind="cloud" label="SentinelOne" note="EPP" tone={PURPLE} size={44} />
          <Device spot="lab:caldera" at={L.caldera!} kind="attacker" label="Caldera" note="10.37.9.118" tone={ATTACKER} size={44} />
          <Platform spot="lab:platform" at={L.platform!} label="Stellar Cyber DP" />
        </div>
        <ol className="mx-auto grid max-w-[58rem] gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
          <li className="col-span-full mb-1 text-[11px] font-semibold tracking-wide text-sc-silver/60 uppercase">
            {w.attack} · {w.attackFrom} <span className="text-sc-burnt">losgatos</span>
          </li>
          {STEPS.map((st, i) => (
            <Spot as="li" key={i} id={`lab:step:${i + 1}`} className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2 px-1 py-0.5">
              <span className="font-bold text-sc-burnt tabular-nums">{i + 1}</span>
              <span className="text-sc-silver/90">
                {w.steps[i]}
                <span className="ml-1 text-[11px] text-sc-silver/45">→ {st.target}</span>
              </span>
              <a className="font-mono text-[11px] text-sc-burnt underline-offset-2 hover:underline" href={`https://attack.mitre.org/techniques/${st.technique.replace('.', '/')}/`} target="_blank" rel="noreferrer">
                {st.technique}
              </a>
            </Spot>
          ))}
        </ol>
      </div>
      <div className="space-y-3">
        <Spot id="lab:access" className="block rounded-2xl border border-sc-sky-light/40 bg-linear-to-br from-[#3044E0]/35 to-[#0A1823]/60 p-4 shadow-[0_20px_60px_-25px_#3044E0]">
          <p className="text-xs font-semibold tracking-wide text-sc-sky-light uppercase">{w.access.title}</p>
          <a href={LAB_URL} target="_blank" rel="noreferrer" className="mt-1 block text-xl font-bold break-all text-sc-silver hover:underline">
            coe.stellarcyber.cloud
          </a>
          <ol className="mt-2 space-y-1 text-sm text-sc-silver/85">
            <li>
              <span className="text-sc-silver/50">1.</span> {w.access.user}: <span className="font-semibold text-sc-silver">{w.access.userValue}</span>
            </li>
            <li>
              <span className="text-sc-silver/50">2.</span> {w.access.code}
            </li>
          </ol>
          <a href={LAB_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg bg-sc-sky px-4 py-2 text-sm font-semibold text-sc-silver hover:bg-sc-sky-mid">
            {w.access.open} ↗
          </a>
        </Spot>
        <Participants list={participants} canRun={canRun} live={live} onLabAccess={onLabAccess} />
      </div>
    </div>
  )
}

/**
 * Who is in the session: the Presenter copies the e-mails to invite them to the lab; each Customer
 * User confirms their own access with a thumbs-up, and everyone sees who did.
 */
function Participants({ list, canRun, live, onLabAccess }: { list: Participant[]; canRun: boolean; live: boolean; onLabAccess: (confirmed: boolean) => Promise<unknown> }) {
  const w = useWords().closing.lab.participants
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600)
    } catch {
      // Clipboard refused (no permission or an insecure page): the e-mail stays selectable on screen.
    }
  }
  const customers = list.filter((p) => p.customer && p.email)
  const me = list.find((p) => p.mine)
  const toggle = async () => {
    setBusy(true)
    try {
      await onLabAccess(!me?.labConfirmed)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Spot id="lab:participants" pointable={false} className="block rounded-xl border border-white/12 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-xs font-semibold text-sc-silver">
          {w.title} <span className="font-normal text-sc-silver/50">({list.filter((p) => p.online).length})</span>
        </p>
        {canRun && customers.length > 0 ? (
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-sc-silver/80 hover:border-white/40 hover:text-sc-silver"
            onClick={() => void copy('all', customers.map((p) => p.email).join('; '))}
          >
            {copied === 'all' ? `✓ ${w.copied}` : `${w.copyAll} (${customers.length})`}
          </button>
        ) : null}
      </div>
      {list.length === 0 ? <p className="text-xs text-sc-silver/50">{w.empty}</p> : null}
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {list.map((p) => (
          <li key={p.userId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${p.mine ? 'bg-white/[0.05]' : ''}`}>
            <span className={`size-2 shrink-0 rounded-full ${p.online ? 'bg-[#3FB950] shadow-[0_0_6px_#3FB950]' : 'bg-white/20'}`} title={p.online ? undefined : w.offline} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-medium text-sc-silver">{p.name}</span>
                {!p.customer ? <span className="rounded bg-sc-sky/40 px-1 text-[10px] text-sc-silver">{w.presenter}</span> : null}
                {p.mine ? <span className="text-[10px] text-sc-silver/45">({w.you})</span> : null}
              </span>
              {p.email ? <span className="block truncate text-[11px] text-sc-silver/55 select-all">{p.email}</span> : null}
            </span>
            {canRun && p.email && !p.mine ? (
              <button type="button" className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-sc-sky-light hover:bg-white/10" onClick={() => void copy(p.userId, p.email!)}>
                {copied === p.userId ? '✓' : w.copy}
              </button>
            ) : null}
            {p.customer ? (
              <span className={`shrink-0 text-base ${p.labConfirmed ? '' : 'opacity-25 grayscale'}`} title={p.labConfirmed ? w.confirmed : w.pending} aria-label={p.labConfirmed ? w.confirmed : w.pending}>
                👍
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {live && me?.customer ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggle()}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            me.labConfirmed ? 'border border-[#3FB950]/50 bg-[#3FB950]/15 text-sc-silver' : 'bg-linear-to-r from-sc-solar to-sc-burnt text-sc-midnight'
          }`}
        >
          <span className="text-lg" aria-hidden>
            👍
          </span>
          {me.labConfirmed ? `${w.confirmed} · ${w.undo}` : w.confirm}
        </button>
      ) : null}
    </Spot>
  )
}
