import resources from '../../common/resources.js'
import VueCache from './VueFileCache.js'

export default async (fastify, options) => {
    const vueCache = VueCache
    const files = resources.files

    const ws_render = (connection, _) => {
        const socket = connection
        let activeRequests = 0
        let renderTimeout = null
        let maintain = false

        // 发送协议
        socket.send(JSON.stringify({
            action: 'protocol', data: {
                application: 'Karin-Support', // 应用名
                short: true, // 支持短连接
                cache: true, // 支持静态文件缓存
                vue: true, // 支持vue
            }
        }))

        // Function to set or reset the render timeout
        const resetRenderTimeout = () => {
            if (maintain) return
            clearTimeout(initialTimeout) // Clear the initial 10 seconds timeout
            if (renderTimeout) {
                clearTimeout(renderTimeout)
            }
            renderTimeout = setTimeout(() => {
                socket.send(JSON.stringify({ action: 'timeout', message: 'Rendering took longer than 5 minutes' }))
                socket.close()
            }, 300000) // 5 minutes timeout
        }

        // Initial 10 seconds timeout
        const initialTimeout = setTimeout(() => {
            socket.send(JSON.stringify({ action: 'timeout', message: 'No render request received within 10 seconds' }))
            socket.close()
        }, 10000)

        // Function to handle the completion of a render request
        const handleCompletion = (res, data) => {
            res.echo = data.echo
            res.action = 'renderRes'
            res.ok = res.status === 'ok'
            if (data.data.encoding == 'base64') {
                res.data = 'base64://' + res.data
            }
            socket.send(JSON.stringify(res))
            activeRequests -= 1
            if (activeRequests === 0 && !maintain) {
                socket.close()
            }
        }

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
                    clearTimeout(initialTimeout)
                    clearTimeout(renderTimeout)
                    maintain = true
                    return // socket.send(JSON.stringify({ type: 'heartbeat', message: 'pone' }))
                case 'render': {
                    activeRequests += 1
                    resetRenderTimeout() // Reset the 5 minutes render timeout

                    try {
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
                        clearTimeout(renderTimeout) // Clear the 5 minutes timeout on completion
                        handleCompletion(res, data)
                    } catch (error) {
                        clearTimeout(renderTimeout) // Clear the 5 minutes timeout on error
                        socket.send(JSON.stringify({ action: 'error', message: error.message }))
                        activeRequests -= 1
                        if (activeRequests === 0) {
                            socket.close()
                        }
                    }
                    break
                }
                case 'renderHtml': {
                    activeRequests += 1
                    resetRenderTimeout() // Reset the 5 minutes render timeout

                    try {
                        let res
                        if (data.action === 'render') {
                            data.data.file = decodeURIComponent(data.data.file)
                            if (data.data.vue) {
                                const cacheId = vueCache.addCache(data.data.file, data.data.name, data.data.props)
                                data.data.file = `http://localhost:${options.port}/vue/${data.data.vueTemplate || 'default'}/?id=${cacheId}&support=true`
                                data.data.waitForFunction = 'window.$vueReady'
                                res = await options.chrome.start(data.data)
                                vueCache.deleteCache(cacheId)
                            } else {
                                res = await options.chrome.start(data.data)
                            }
                        } else if (data.action === 'renderHtml') {
                            const file = decodeURIComponent(data.data.file)
                            const hash = `render-${crypto.randomUUID()}`
                            const host = `http://localhost:${options.port}/puppeteer/api/render?hash=${hash}`
                            files.set(hash, { ws: socket, file })
                            data.data.file = host
                            data.data.hash = hash
                            res = await options.chrome.start(data.data)
                        }
                        clearTimeout(renderTimeout) // Clear the 5 minutes timeout on completion
                        handleCompletion(res, data)
                    } catch (error) {
                        clearTimeout(renderTimeout) // Clear the 5 minutes timeout on error
                        socket.send(JSON.stringify({ action: 'error', message: error.message }))
                        activeRequests -= 1
                        if (activeRequests === 0) {
                            socket.close()
                        }
                    }
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
    }
    const get_render = (request, reply) => {
        try {
            const { hash } = request.query
            reply.header('Content-Type', 'text/html; charset=utf-8')
            const data = files.get(hash)
            if (!data) return reply.code(500).send({ code: 404, msg: 'Not Found' })
            reply.send(data.file)
        } catch (e) {
            reply.code(500).send({ code: 500, msg: 'Internal Server Error' })
        }
    }
    const post_render = async (request, reply) => {
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
    }

    fastify.get('/ws/render', { websocket: true }, ws_render)
    fastify.get('/api/render', get_render)
    fastify.post('/api/render', post_render)
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
    fastify.register(async () => {
        fastify.route({
            method: 'GET',
            url: '/',
            handler: get_render,
            wsHandler: ws_render
        })
    })
    fastify.post('/', post_render)
    fastify.head('/', async (_, reply) => {
        reply.code(200).send()
    })
}
