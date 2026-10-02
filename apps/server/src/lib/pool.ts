/** Runs `worker` over `items` with at most `concurrency` in flight. Rejections propagate. */
export async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item)
    }),
  )
}
