import { defineHandler } from 'nitro/h3'

export default defineHandler(async () => {
    return {
        status: 'ok',
    }
})
