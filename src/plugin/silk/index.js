import path from 'path'
import AudioConverter from './AudioConverter.js';

export default async (fastify, options) => {
    const audioConverter = new AudioConverter();

    fastify.post('/encode', {
        schema: {
            response: {
                504: { type: 'string', description: 'Timeout error' }
            },
            config: {
                timeout: 3 * 60 * 1000 // 2分钟超时
            }
        }
    }, async (request, reply) => {
        const file = await request.file()
        let silk, inputStream
        try {
            const filename = `${path.basename(file.filename, path.extname(file.filename))}.silk`;
            inputStream = file.file
            reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
            reply.type('audio/silk')
            silk = await audioConverter.convertToSilk(inputStream, 48000)
            reply.send(silk)
        } catch (error) {
            console.log(error)
            reply.code(500).send({ error: error.message })
        } finally {
            // 清理缓存数据
            if (silk) silk = null
            if (inputStream) inputStream = null
        }
    })

    fastify.post('/decode', {
        schema: {
            response: {
                504: { type: 'string', description: 'Timeout error' }
            },
            config: {
                timeout: 3 * 60 * 1000 // 2分钟超时
            }
        }
    }, async (request, reply) => {
        const file = await request.file()
        let wav, inputBuffer
        try {
            const filename = `${path.basename(file.filename, path.extname(file.filename))}.wav`;
            inputBuffer = await file.toBuffer()
            wav = await audioConverter.convertToWav(inputBuffer)
            reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
            reply.type('audio/wav')
            reply.send(wav)
        } catch (error) {
            console.log(error)
            reply.code(500).send({ error: error.message })
        } finally {
            // 清理缓存数据
            if (wav) wav = null
            if (inputBuffer) inputBuffer = null
        }
    })

    fastify.addHook('onTimeout', (request, reply, done) => {
        // 在请求超时后执行清理操作
        // 可以根据需求清理一些大型数据
        // 示例: 清理某些与请求相关的变量
        request.raw.silk = null
        request.raw.wav = null
        request.raw.inputStream = null
        done()
    })
}