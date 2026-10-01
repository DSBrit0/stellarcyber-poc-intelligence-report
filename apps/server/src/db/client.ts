import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.js'
import * as schema from './schema.js'

// ~10 concurrent Users: a small pool per process is plenty.
export const sql = postgres(config().DATABASE_URL, { max: 10, idle_timeout: 30, onnotice: () => {} })
export const db = drizzle(sql, { schema })
export type Db = typeof db
