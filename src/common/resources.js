import NodeCache from 'node-cache';

class Resources {
    constructor() {
        this.files = new Map()
        this.cache = new NodeCache({ stdTTL: 60 * 60 * 24, maxKeys: 1000 })
    }

    async SendApi(ws, action, params, timeout = 120000) {
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
            }, timeout)
        })
    }

}
export default new Resources()