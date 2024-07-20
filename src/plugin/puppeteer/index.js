import fs from 'fs'
import path from 'path'
import util from 'util'
import VueCache from './VueFileCache.js'

export default async (fastify, options) => {
    const vueCache = VueCache
    const files = new Map()

    fastify.get('/ws/render', { websocket: true }, (connection, req) => {
        const socket = connection
        // 处理接收到的消息
        socket.on('message', async data => {
            try {
                data = JSON.parse(data)
            } catch (error) {
                return
            }
            if (data?.data && !data.data.encoding) {
                data.data.encoding = 'base64'
            }
            if (data.screensEval) {
                data.waitForSelector = data.screensEval
            }
            switch (data.action) {
                case 'heartbeat':
                    return // socket.send(JSON.stringify({ type: 'heartbeat', message: 'pone' }))
                case 'render': {
                    data.data.file = decodeURIComponent(data.data.file)
                    let res
                    if (data.data.vue) {
                        const cacheId = vueCache.addCache(data.data.file, data.data.name, data.data.props)
                        data.data.file = `http://localhost:${options.port}/vue/${data.data.vueTemplate || 'default'}/?id=${cacheId}&support=true`
                        data.data.waitForFunction = 'window.$vueReady'
                        res = await options.chrome.start(data.data)
                        vueCache.deleteCache(cacheId)
                    } else {
                        res = await options.chrome.start(data.data)
                    }
                    res.echo = data.echo
                    res.action = 'renderRes'
                    res.ok = res.status === 'ok'
                    if (data.data.encoding == 'base64') {
                        res.data = 'base64://' + res.data
                    }
                    socket.send(JSON.stringify(res))
                    break
                }
                case 'renderHtml': {
                    const file = decodeURIComponent(data.data.file)
                    const hash = `render-${crypto.randomUUID()}`
                    const host = `http://localhost:${options.port}/puppeteer/api/render?hash=${hash}`
                    files.set(hash, { ws: socket, file })
                    data.data.file = host
                    data.data.hash = hash
                    const res = await options.chrome.start(data.data)
                    res.echo = data.echo
                    res.action = 'renderRes'
                    res.ok = res.status === 'ok'
                    if (data.data.encoding == 'base64') {
                        res.data = 'base64://' + res.data
                    }
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
    fastify.get('/api/render', async (request, reply) => {
        try {
            const { hash } = request.query
            reply.header('Content-Type', 'text/html; charset=utf-8')
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
        if (data.screensEval) {
            data.waitForSelector = data.screensEval
        }
        if (data.vue) {
            const cacheId = vueCache.addCache(data.file, data.name, data.props)
            data.file = `http://localhost:${options.port}/vue/${data.vueTemplate || 'default'}/?id=${cacheId}&support=true`
            data.waitForFunction = 'window.$vueReady'
            let image = await options.chrome.start(data)
            image.ok = image.status === 'ok'
            if (data.encoding == 'base64') {
                image.data = 'base64://' + image.data
            }
            vueCache.deleteCache(cacheId)
            reply.send(image)
        } else {
            if (token !== options.token) {
                return reply.code(403).send({ code: 403, msg: 'Token错误' })
            }
            const image = await options.chrome.start(data)
            image.ok = image.status === 'ok'
            if (data.encoding == 'base64') {
                image.data = 'base64://' + image.data
            }
            reply.send(image)
        }
    })
    fastify.post('/getTemplate', async (request, reply) => {
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

    // 处理静态资源请求
    fastify.get('/resources/*', async (request, reply) => {
        if (request.query.hash) return reply.code(404).send({ message: `Resources GET:${request.url} not found`, error: "Not Found", statusCode: 404 })

        // 获取唯一id
        const hash = request.headers['x-renderer-id'] || request.headers.referer?.match(/hash=([^&]+)/)?.[1] || request.headers.referer?.match(/hash=([^&]+)/)?.[1];
        if (!hash) return reply.code(404).send({ message: `Resources GET:${request.url} not found`, error: "Not Found", statusCode: 404 })

        // 如果是/favicon.ico 则返回本地
        if (request.url === '/favicon.ico') {
            const file = fs.readFileSync('./src/resources/favicon.ico')
            reply.header('Content-Type', 'image/x-icon')
            return reply.send(file)
        }

        // 获取对应的ws
        const file = files.get(hash)
        if (!file || !file.ws) return reply.code(404).send({ message: `Resources GET:${request.url} not found`, error: "Not Found", statusCode: 404 })

        const SendApi = async (ws, action, params) => {
            const time = 120
            const echo = crypto.randomUUID()
            const request = JSON.stringify({ echo, action, params })
            return new Promise((resolve, reject) => {
                ws.send(request)
                ws.once(echo, (data) => {
                    if (data.status === 'ok') {
                        resolve(data.data)
                    } else {
                        reject(data)
                    }
                })
                setTimeout(() => {
                    reject(new Error('API请求超时'))
                }, time * 1000)
            })
        }

        const url = request.url.replace(/^\/puppeteer\/resources/, "");
        // 发送请求
        let data = SendApi(file.ws, 'static', { file: url })

        // 获取url后缀
        const ext = path.extname(url).toLowerCase()
        let contentType = 'application/octet-stream'

        try {
            contentType = Config.mime[ext]
        } catch {
            console.error('[服务器][GET][ContentType] 获取 mime 错误')
        }

        if (util.types.isPromise(data)) data = await data
        reply.header('Content-Type', contentType)
        reply.send(Buffer.from(data.file.data))
    })

}
