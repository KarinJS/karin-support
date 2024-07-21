class Resources {
    constructor() {
        this.files = new Map()
    }

    async SendApi(ws, action, params) {
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
}
export default new Resources()