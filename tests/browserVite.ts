import { createServer, mergeConfig, type InlineConfig, type ViteDevServer } from 'vite'

/* The dev server every real-Chromium suite serves its fixtures from. A full
   run starts one per file, several at once, all rooted at this checkout. With
   Vite's file watcher and HMR live, any change under the root during the run
   (an editor save, a backlog edit, a test writing into public/) reloads every
   open fixture page mid-test and drops its harness: touching src/lib/utils.ts
   every 2s under --maxWorkers=4 failed 33 of 164 browser tests, the same run
   without it passed all of them (TASK-73). The suites need a fixed snapshot
   of the source, so the watcher and HMR stay off. */
export function createBrowserVite(config: InlineConfig = {}): Promise<ViteDevServer> {
  return createServer(mergeConfig({ logLevel: 'error', server: { port: 0, watch: null, hmr: false } }, config))
}
