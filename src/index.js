import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocketPlugin from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import multipart from '@fastify/multipart'
import autoLoad from '@fastify/autoload'
import middie from '@fastify/middie'
import { Core } from 'karin-screenshot'
import resources from './common/resources.js'
import path from 'path'
import util from 'util'
import fs from 'fs'

const port = process.env.PORT || 7005
const token = process.env.TOKEN || 'Karin-Puppeteer'
const timeout = process.env.TIMEOUT || 90000
const debug = (process.env.DEBUG || 'false').toLowerCase() === 'true'

// 初始化karin-screenshot
const chrome = new Core({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'shell',
    devtools: false,
    dir: process.cwd(),
    browserCount: 10
})
await chrome.init()

// 创建Fastify实例
const fastify = Fastify({ logger: debug, bodyLimit: 50 * 1024 * 1024 })
// 注册插件
await fastify.register(websocketPlugin)
await fastify.register(multipart)
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
    // 读取缓存
    const cachedResource = resources.cache.get(url)
    if (cachedResource) {
        res.setHeader('Content-Type', cachedResource.contentType)
        res.end(cachedResource.data)
        return next()
    }
    // 如果是/favicon.ico 则返回本地
    if (url === '/favicon.ico') {
        const file = fs.readFileSync('./resources/favicon.ico')
        res.header('Content-Type', 'image/x-icon')
        return res.end(file)
    }
    const file = resources.files.get(hash)
    if (!file || !file.ws) return next()
    // 发送请求
    let data = resources.SendApi(file.ws, 'static', { file: url }, timeout)

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
    // 缓存静态文件
    resources.cache.set(url, {
        url,
        hash,
        contentType,
        data: Buffer.from(data.file.data)
    })
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
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8f9fa;
            color: #343a40;
            text-align: center;
            padding: 50px;
        }
        h1 {
            color: #007bff;
            margin-bottom: 20px;
        }
        h2 {
            color: #6c757d;
            margin-bottom: 15px;
            text-align: left;
        }
        ul {
            list-style: none;
            padding: 0;
        }
        li {
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            margin-bottom: 10px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .api {
            border-radius: 5px;
            padding: 5px 10px;
            color: #fff;
            margin-right: 10px;
        }
        .get-api {
            background-color: #28a745;
        }
        .post-api {
            background-color: #ffc107;
        }
        .ws-api {
            background-color: #17a2b8;
        }
        .copy-button {
            background-color: #007bff;
            color: #fff;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        .copy-button:hover {
            background-color: #0056b3;
        }
        .copy-success {
            display: none;
            color: #28a745;
            margin-left: 10px;
        }
        .copy-success.show {
            display: inline;
        }
    </style>
</head>
<body>
    <h1>Karin Support API 服务已启动</h1>
    <h2>Puppeteer</h2>
    <ul>
        <li>
            <div>
                <strong class="get-api api">GET</strong><strong class="post-api api">POST</strong><strong class="ws-api api">WS</strong><strong>通用接口:</strong> /puppeteer/
            </div>
            <div>
                <span class="copy-success" id="copy-success-1">已复制</span>
                <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/puppeteer/\`, 1)">复制</button>
            </div>
        </li>
        <li>
            <div>
                <strong class="ws-api api">WS</strong><strong>websocket 渲染器:</strong> /puppeteer/ws/render
            </div>
            <div>
                <span class="copy-success" id="copy-success-2">已复制</span>
                <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/puppeteer/ws/render\`, 2)">复制</button>
            </div>
        </li>
        <li>
            <div>
                <strong class="get-api api">GET</strong><strong class="post-api api">POST</strong><strong>http 渲染器:</strong> /puppeteer/ws/render
            </div>
            <div>
                <span class="copy-success" id="copy-success-3">已复制</span>
                <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/puppeteer/api/render\`, 3)">复制</button>
            </div>
        </li>
    </ul>
    <h2>Wormhole</h2>
    <ul>
        <li>
            <div>
                <strong class="ws-api api">WS</strong><strong>客户端连接:</strong> /wormhole/ws/:clientId
            </div>
            <div>
                <span class="copy-success" id="copy-success-4">已复制</span>
                <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/wormhole/ws/\`, 4)">复制</button>
            </div>
        </li>
    </ul>
    <h2>Silk</h2>
    <ul>
        <li>
            <div>
                <strong class="post-api api">POST</strong><strong>音频转码SILK:</strong> /silk/encode
            </div>
            <div>
                <span class="copy-success" id="copy-success-5">已复制</span>
                <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/silk/encode\`, 5)">复制</button>
            </div>
        </li>
        <li>
            <div>
                <strong class="post-api api">POST</strong><strong>SILK转码PCM:</strong> /silk/decode
            </div>
            <div>
                <span class="copy-success" id="copy-success-6">已复制</span>
                <button class="copy-button" onclick="copyToClipboard(\`\${window.location.origin}/silk/decode\`, 6)">复制</button>
            </div>
        </li>
    </ul>
    <script>
        function copyToClipboard(text, id) {
            const tempInput = document.createElement('input');
            tempInput.value = text;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            
            const copySuccess = document.getElementById('copy-success-' + id);
            copySuccess.classList.add('show');
            setTimeout(() => {
                copySuccess.classList.remove('show');
            }, 2000);
        }
    </script>
</body>
</html>
`)
})
// 缓存信息
fastify.get('/cache', async (request, reply) => {
    let rows = '';
    resources.cache.keys().forEach(item => {
        rows += `
            <tr>
                <td>${item}</td>
            </tr>
        `;
    });
    reply.header('Content-Type', 'text/html')
    reply.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>缓存文件列表</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th, td {
                padding: 10px;
                border: 1px solid #ddd;
                text-align: left;
            }
            th {
                background-color: #f4f4f4;
            }
        </style>
    </head>
    <body>
        <h1>缓存文件列表</h1>
        <table>
            <thead>
                <tr>
                    <th>文件路径</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    </body>
    </html>
    `)
})
// 启动fastify服务
fastify.listen({ port: port || 3000, host: '::' })
console.log(`启动fastify,端口:${port}`)