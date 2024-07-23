import { encode, decode } from 'silk-wasm'
import { Writable } from 'stream'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

export default async (fastify, options) => {
    fastify.post('/encode', async (request, reply) => {
        const file = await request.file()
        try {
            const inputStream = file.file
            reply.header('Content-Disposition', `attachment; filename="${path.basename(file.filename, path.extname(file.filename))}.silk"`)
            reply.type('audio/silk')
            const wav = await convertToWav(inputStream)
            const silk = await encode(wav, 24000)
            reply.send(silk.data)
        } catch (error) {
            console.log(error)
            reply.code(500).send({ error: error.message })
        }
    })
    fastify.post('/decode', async (request, reply) => {
        const file = await request.file()
        try {
            const inputBuffer = await file.toBuffer()
            reply.header('Content-Disposition', `attachment; filename="${path.basename(file.filename, path.extname(file.filename))}.pcm"`)
            reply.type('audio/pcm')
            const pcm = await decode(inputBuffer, 24000)
            reply.send(pcm.data)
        } catch (error) {
            console.log(error)
            reply.code(500).send({ error: error.message })
        }
    })
}

class MemoryWritableStream extends Writable {
    constructor() {
        super({ objectMode: true })
        this.chunks = []
    }
    _write(chunk, encoding, callback) {
        this.chunks.push(chunk)
        callback()
    }
    getData() {
        return Buffer.concat(this.chunks)
    }
}

async function convertToWav(inputBuffer) {
    return new Promise((resolve, reject) => {
        const outputBuffer = new MemoryWritableStream()
        ffmpeg()
            .input(inputBuffer)
            .audioCodec('pcm_s16le')
            .toFormat('wav')
            .on('end', () => resolve(outputBuffer.getData()))
            .on('error', (err) => reject(err))
            .pipe(outputBuffer, { end: true })
    })
}