import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import autoLoad from '@fastify/autoload'
import middie from '@fastify/middie'
import { Core } from 'karin-screenshot'
import resources from './plugin/puppeteer/resources.js'
import path from 'path'
import util from 'util'
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
await fastify.register(websocketPlugin)
await fastify.register(middie)
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

fastify.use(['/resources', '/plugins'], async (request, res, next) => {
    const hash = request.headers['x-renderer-id'] || request.headers.referer?.match(/hash=([^&]+)/)?.[1] || request.headers.referer?.match(/hash=([^&]+)/)?.[1]
    if (!hash) return next()
    const url = request.originalUrl
    // 如果是/favicon.ico 则返回本地
    if (url === '/favicon.ico') {
        const file = fs.readFileSync('./resources/favicon.ico')
        res.header('Content-Type', 'image/x-icon')
        return res.end(file)
    }
    const file = resources.files.get(hash)
    if (!file || !file.ws) return next()
    // 发送请求
    let data = resources.SendApi(file.ws, 'static', { file: url })

    // 获取url后缀
    const ext = path.extname(url).toLowerCase()
    const mime = {
        // html css
        ".css": "text/css",
        ".html": "text/html",
        ".htm": "text/html",
        ".js": "application/javascript",
        // 图片
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".webp": "image/webp",
        ".avif": "image/avif",
        ".apng": "image/apng",
        // 音频,
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".weba": "audio/webm",
        // 视频,
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        // 字体,
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".eot": "application/vnd.ms-fontobject",
        ".sfnt": "font/sfnt",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        // 文本,
        ".txt": "text/plain",
        ".json": "application/json",
        ".xml": "application/xml",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    let contentType = 'application/octet-stream'
    try {
        contentType = mime[ext]
    } catch {
        console.error('[服务器][GET][ContentType] 获取 mime 错误')
    }
    try {
        if (util.types.isPromise(data)) data = await data
    } catch {
        return next()
    }
    res.setHeader('Content-Type', contentType)
    res.end(Buffer.from(data.file.data))
    next()
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
        body { font-family: Arial, sans-serif; background-color: #f0f0f0; text-align: center; padding: 50px; }
        h1 { color: #333; } p { color: #666; } ul { list-style: none; padding: 0; } li { margin-bottom: 10px; }
        .copy-button { background-color: #007bff; color: #fff; border: none; padding: 5px 10px; cursor: pointer;}
        .api { border-radius: 5px; margin-right: 5px; } .get-api {  background-color: #229954; } .post-api { background-color: #FFC300; } .ws-api { background-color: #33FFF4; }
    </style>
</head>
<body>
    <h1>Karin Support API 服务已启动</h1>
    <h2>Puppeteer</h2>
    <ul>
        <li>
            <strong class="ws-api api">WS</strong><strong>websocket 渲染器:</strong> /puppeteer/ws/render
            <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/puppeteer/ws/render\`)">复制</button>
            <span class="copy-success" id="copy-success-1"></span>
        </li>
        <li>
            <strong class="get-api api">GET</strong><strong class="post-api">POST</strong><strong>http 渲染器:</strong> /puppeteer/ws/render
            <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/api/render\`)">复制</button>
            <span class="copy-success" id="copy-success-2"></span>
        </li>
    </ul>
    <h2>Wormhole</h2>
    <ul>
        <li>
            <strong class="ws-api api">WS</strong><strong>客户端连接</strong> /wormhole/ws/:clientId
            <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/wormhole/ws/\`)">复制</button>
            <span class="copy-success" id="copy-success-1"></span>
        </li>
    </ul>
    <script>
        function copyToClipboard(text) { const tempInput = document.createElement('input'); tempInput.value = text; document.body.appendChild(tempInput); tempInput.select(); document.execCommand('copy'); document.body.removeChild(tempInput); alert(\`API \${text} 已复制到剪贴板！\`); }
    </script>
</body>
</html>
`)
})
// 启动fastify服务
fastify.listen({ port: port || 3000, host: '::' })
console.log(`启动fastify,端口:${port}`)