import { sql } from '../db/client.js'

// Report versioning: a Report's major version is its sequence number within the PoC (one per
// Sync), its minor version the number of Report comments it has. Appendix B lists every version up
// to the Report being rendered: each Sync, then each Report comment, oldest first.

export interface VersionEntry {
  version: string
  date: string
  author: string | null
  /** A Report comment; null for a Sync, which the Template describes from `first` and `period`. */
  changes: string | null
  first: boolean
  period: { start: string; end: string } | null
}

export interface Versioning {
  version: string
  history: VersionEntry[]
}

export async function loadVersioning(reportDataId: string): Promise<Versioning | null> {
  const reports = await sql<{ id: string; seq: number; createdAt: Date; author: string | null; start: string | null; end: string | null }[]>`
    select r.id, r.seq, r.created_at as "createdAt", u.name as author, r.data->'period'->>'start' as start, r.data->'period'->>'end' as end
    from report_data r
    join report_data cur on cur.id = ${reportDataId} and cur.poc_id = r.poc_id and r.seq <= cur.seq
    left join syncs s on s.report_data_id = r.id
    left join users u on u.id = s.requested_by
    order by r.seq`
  if (!reports.length) return null
  const comments = await sql<{ reportDataId: string; body: string; createdAt: Date; author: string | null }[]>`
    select c.report_data_id as "reportDataId", c.body, c.created_at as "createdAt", u.name as author
    from report_comments c left join users u on u.id = c.user_id
    where c.kind = 'report' and c.report_data_id in ${sql(reports.map((r) => r.id))}
    order by c.created_at, c.id`
  const history: VersionEntry[] = []
  let minor = 0
  for (const [i, r] of reports.entries()) {
    history.push({ version: `${r.seq}.0`, date: new Date(r.createdAt).toISOString(), author: r.author, changes: null, first: i === 0, period: r.start && r.end ? { start: r.start, end: r.end } : null })
    minor = 0
    for (const c of comments.filter((x) => x.reportDataId === r.id)) {
      minor++
      history.push({ version: `${r.seq}.${minor}`, date: new Date(c.createdAt).toISOString(), author: c.author, changes: c.body, first: false, period: null })
    }
  }
  return { version: `${reports.at(-1)!.seq}.${minor}`, history }
}
