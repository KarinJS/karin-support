import NodeCache from 'node-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const TTL = parseInt(process.env.CACHE_TTL) || 1440
const MaxKey = parseInt(process.env.CACHE_MAXKEY) || 1000

class Resources {
    constructor() {
        this.files = new Map();
        this.cache = new NodeCache({ stdTTL: 60 * TTL, maxKeys: MaxKey });
        this.cacheDir = path.resolve(process.cwd(), 'resources');

        // 确保缓存目录存在
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    async SendApi(ws, action, params, timeout = 120000) {
        const echo = crypto.randomUUID();

        // 检查缓存
        const cachedData = await this.readCache(params.file);

        if (cachedData) {
            // 计算缓存数据的MD5值
            const md5List = Object.keys(cachedData);
            params.md5 = md5List;
        }

        const request = JSON.stringify({ echo, action, params });

        return new Promise((resolve, reject) => {
            ws.send(request);

            ws.once(echo, (data) => {
                if (data.status === 'ok') {
                    const verifiedMd5 = data.data.verifiedMd5;
                    if (cachedData && verifiedMd5 && cachedData[verifiedMd5]) {
                        // 服务器验证通过，使用缓存数据
                        resolve({
                            file: {
                                data: cachedData[verifiedMd5].data
                            }
                        });
                    } else {
                        // 服务器验证不通过，使用返回数据
                        resolve(data.data);
                    }
                } else {
                    reject(data);
                }
            });

            setTimeout(() => {
                reject(new Error('API请求超时'));
            }, timeout);
        });
    }

    async readCache(cacheKey) {
        // 读取内存缓存
        let cachedData = this.cache.get(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        // 读取本地磁盘缓存
        const cacheFilePath = path.join(this.cacheDir, crypto.createHash('md5').update(cacheKey).digest('hex') + '.bin');
        if (fs.existsSync(cacheFilePath)) {
            const buffer = fs.readFileSync(cacheFilePath);
            const decompressed = zlib.gunzipSync(buffer);
            const cacheData = JSON.parse(decompressed.toString());

            for (let md5 in cacheData) {
                const dataBuffer = Buffer.from(cacheData[md5].data, 'base64');
                const computedMd5 = crypto.createHash('md5').update(dataBuffer).digest('hex');
                if (computedMd5 === md5) {
                    cacheData[md5].data = dataBuffer;
                } else {
                    delete cacheData[md5];
                }
            }

            this.cache.set(cacheKey, cacheData); // 更新内存缓存
            return cacheData;
        }

        return null;
    }

    writeCache(cacheKey, data) {
        // 写入内存缓存
        let cachedData = this.cache.get(cacheKey) || {};
        cachedData[data.md5] = data;
        this.cache.set(cacheKey, cachedData);

        // 写入本地磁盘缓存
        const cacheFilePath = path.join(this.cacheDir, crypto.createHash('md5').update(cacheKey).digest('hex') + '.bin');
        let diskCacheData = {};

        if (fs.existsSync(cacheFilePath)) {
            const buffer = fs.readFileSync(cacheFilePath);
            const decompressed = zlib.gunzipSync(buffer);
            diskCacheData = JSON.parse(decompressed.toString());
        }

        diskCacheData[data.md5] = {
            url: data.url,
            hash: data.hash,
            contentType: data.contentType,
            data: data.data.toString('base64'),
            md5: data.md5
        };

        const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(diskCacheData)));
        fs.writeFileSync(cacheFilePath, compressed);
    }

}

export default new Resources();
