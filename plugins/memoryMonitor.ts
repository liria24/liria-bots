import { definePlugin } from 'nitro'
import { useRuntimeConfig } from 'nitro/runtime-config'

import { logger } from '../utils/logger'

const log = logger('memory')

export default definePlugin((nitroApp) => {
    const { memoryMonitor } = useRuntimeConfig()

    if (!memoryMonitor) {
        log.info('Memory monitor is disabled')
        return
    }

    log.success('Memory monitor is enabled')

    const formatBytes = (bytes: number): string => {
        const mb = bytes / 1024 / 1024
        return `${mb.toFixed(2)} MB`
    }

    const logMemoryUsage = () => {
        const usage = process.memoryUsage()
        log.info('Memory Usage:', {
            rss: formatBytes(usage.rss),
            heapTotal: formatBytes(usage.heapTotal),
            heapUsed: formatBytes(usage.heapUsed),
            external: formatBytes(usage.external),
            arrayBuffers: formatBytes(usage.arrayBuffers),
        })
    }

    // Log immediately on startup
    logMemoryUsage()

    // Log every 5 seconds
    const intervalId = setInterval(logMemoryUsage, 5000)

    // Cleanup on shutdown
    nitroApp.hooks.hook('close', () => {
        log.info('Stopping memory monitor')
        clearInterval(intervalId)
    })
})
