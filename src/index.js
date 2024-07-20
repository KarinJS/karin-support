import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import autoLoad from '@fastify/autoload'
import { Core } from 'karin-screenshot'
import path from 'path'
import fs from 'fs'

const port = process.env.PORT || 7005
const token = process.env.TOKEN || 'Karin-Puppeteer'
const timeout = process.env.TIMEOUT || 90000
const debug = process.env.DEBUG || false

// 初始化karin-screenshot
const chrome = new Core({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    devtools: false,
    dir: process.cwd(),
    browserCount: 10
})
await chrome.init()

// 创建Fastify实例
const fastify = Fastify({ logger: debug })
// 注册WebSocket插件
fastify.register(websocketPlugin)
// 配置跨域请求
fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST']
})
// 注册Vue
fs.readdirSync(path.resolve('./src/vueTemplate')).forEach(async dir => {
    const subdirPath = path.resolve(path.join('./src/vueTemplate', dir))
    if (fs.statSync(subdirPath).isDirectory()) {
        fastify.register(fastifyStatic, {
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
fastify.register(autoLoad, {
    dir: path.resolve('src/plugin'),
    dirNameRoutePrefix: true,
    maxDepth: 1,
    options: { port, token, debug, chrome }
})
// 重定向资源
fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/puppeteer')) {
        return reply.redirect('/puppeteer/resources' + request.url)
    } else {
        reply.from(404)
    }
})
// 主页
fastify.get('/', async (request, reply) => {
    reply.header('Content-Type', 'text/html')
    reply.send(`
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KarinSupport API 服务启动提示</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
            text-align: center;
            padding: 50px;
        }
        h1 {
            color: #333;
        }
        p {
            color: #666;
        }
    </style>
</head>
<body>
    <h1>Karin Support API 服务已启动</h1>
</body>
</html>
`)
})
// 启动fastify服务
fastify.listen({ port: port || 3000, host: '::' })
console.log(`启动fastify,端口:${port}`)