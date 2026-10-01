import { resolve } from 'node:path'

// Processes run with the server package root as working directory (npm -w in dev, WORKDIR in Docker).
export const MIGRATIONS_DIR = resolve(process.cwd(), 'migrations') + '/'
