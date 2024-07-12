import VueCache from './VueFileCache.js'
import { Core } from 'karin-screenshot'

export default async (fastify, options) => {
    const vueCache = VueCache
    const files = new Map()

    const chrome = new Core({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
        devtools: false,
        dir: process.cwd(),
        browserCount: 10
    })

    await chrome.init()

    fastify.get('/ws/render', { websocket: true }, (connection, req) => {
        const socket = connection
        // 处理接收到的消息
        socket.on('message', async data => {
            try {
                data = JSON.parse(data)
            } catch (error) {
                return
            }
            switch (data.action) {
                case 'heartbeat':
                    return // socket.send(JSON.stringify({ type: 'heartbeat', message: 'pone' }))
                case 'render': {
                    data.data.file = decodeURIComponent(data.data.file)
                    let res
                    if (!data.data.encoding) {
                        data.data.encoding = 'base64'
                    }
                    if (data.data.vue) {
                        const cacheId = vueCache.addCache(data.data.file, data.data.name, data.data.props)
                        data.data.file = `http://localhost:${options.port}/vue/${data.data.vueTemplate || 'default'}/?id=${cacheId}`
                        res = await chrome.start(data.data)
                        vueCache.deleteCache(cacheId)
                    } else {
                        res = await chrome.start(data.data)
                    }
                    res.echo = data.echo
                    res.action = 'renderRes'
                    socket.send(JSON.stringify(res))
                    break
                }
                case 'renderHtml': {
                    const file = decodeURIComponent(data.data.file)
                    const hash = `render-${crypto.randomUUID()}`
                    const host = `http://localhost:${port}/api/render?hash=${hash}`
                    http.file.set(hash, { ws: this, file })
                    data.data.file = host
                    data.data.hash = hash
                    const res = await chrome.start(data.data)
                    res.echo = data.echo
                    res.action = 'renderRes'
                    socket.send(JSON.stringify(res))
                    break
                }
                case 'static': {
                    socket.emit(data.echo, data)
                    break
                }
                default:
                    break
            }
        })
    })
    fastify.get('/api/render/', async (request, reply) => {
        try {
            const { hash } = request.query
            reply.setHeader('Content-Type', 'text/html; charset=utf-8')
            const data = files.get(hash)
            if (!data) return reply.code(500).send({ code: 404, msg: 'Not Found' })
            reply.send(data.file)
        } catch (e) {
            reply.code(500).send({ code: 500, msg: 'Internal Server Error' })
        }
    })
    fastify.post('/api/render', async (request, reply) => {
        const token = request.headers.authorization
        const data = request.body
        if (!data.encoding) {
            data.encoding = 'base64'
        }
        if (data.vue) {
            const cacheId = vueCache.addCache(data.file, data.name, data.props)
            data.file = `http://localhost:${options.port}/vue/${data.vueTemplate || 'default'}/?id=${cacheId}`
            const image = await chrome.start(data)
            vueCache.deleteCache(cacheId)
            reply.send(image)
        } else {
            if (token !== options.token) {
                return reply.code(403).send({ code: 403, msg: 'Token错误' })
            }
            const image = await chrome.start(data)
            reply.send(image)
        }
    })
    fastify.post('/vue/getTemplate', async (request, reply) => {
        const data = request.body
        if (data.id) {
            const vue = vueCache.getCache(data.id)
            if (vue) {
                reply.send({ status: 'success', ...vue })
            } else {
                reply.send({ status: 'failed', msg: 'Vue Data Error' })
            }
        } else {
            reply.code(500).send({ code: 500, status: 'failed', msg: 'Vue cache is not found' })
        }
    })
}
