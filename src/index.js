import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import autoLoad from '@fastify/autoload'
import path from 'path'
import fs from 'fs'

const port = process.env.PORT || 7005
const token = process.env.TOKEN || 'Karin-Puppeteer'
const timeout = process.env.TIMEOUT || 90000
const debug = process.env.DEBUG || false

// 创建Fastify实例
const fastify = Fastify({ logger: debug })
// 注册WebSocket插件
await fastify.register(websocketPlugin)
// 配置跨域请求
await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST']
})
// 注册Vue
fs.readdirSync(path.resolve('./src/vueTemplate')).forEach(async dir => {
    const subdirPath = path.resolve(path.join('./src/vueTemplate', dir))
    if (fs.statSync(subdirPath).isDirectory()) {
        await fastify.register(fastifyStatic, {
            root: subdirPath,
            prefix: `/vue/${dir}`,
            decorateReply: (reply, request) => {
                if (request.url === '/') {
                    reply.sendFile('index.html')
                }
            }
        })
    }
})
// 注册路由
await fastify.register(autoLoad, {
    dir: path.resolve('src/plugin'),
    dirNameRoutePrefix: true,
    maxDepth: 1,
    options: { port, token, debug }
})
// 启动fastify服务
fastify.listen({ port: port || 3000, host: '::' })