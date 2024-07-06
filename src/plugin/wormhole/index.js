import { ClientManager } from './clientManager.js'
import { WebDataStore } from './webDataStore.js'

import websocketRoutes from './routes/websocket.js'
import webRoutes from './routes/web.js'
import wsRoutes from './routes/ws.js'

export default async (fastify, options) => {
  const clientManager = new ClientManager()
  const webDataStore = new WebDataStore()
  options.options = {
    clientManager,
    webDataStore
  }
  await fastify.register(websocketRoutes, { prefix: '/ws', options })
  await fastify.register(webRoutes, { prefix: '/web', options })
  await fastify.register(wsRoutes, { prefix: '/websocket', options })
  console.log('启动wormhole')
}
