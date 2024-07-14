import { ClientManager } from './clientManager.js'
import { WebDataStore } from './webDataStore.js'

import websocketRoutes from './routes/websocket.js'
import webRoutes from './routes/web.js'
import wsRoutes from './routes/ws.js'

export default async (fastify, options) => {
  const clientManager = new ClientManager()
  const webDataStore = new WebDataStore()
  options = {
    ...options,
    clientManager,
    webDataStore
  }
  fastify.register(websocketRoutes, { prefix: '/ws', options })
  fastify.register(webRoutes, { prefix: '/web', options })
  fastify.register(wsRoutes, { prefix: '/websocket', options })
}
