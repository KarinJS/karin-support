import { encode, decode, isSilk } from 'silk-wasm'
import { Writable, Duplex } from 'stream'
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
            const silk = await encode(wav, 48000)
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
            const pcm = isSilk(inputBuffer) ? Buffer.from((await decode(inputBuffer, 48000)).data) : inputBuffer
            const readable = Duplex.from(pcm)
            const wav = await convertToWav(readable)
            reply.header('Content-Disposition', `attachment; filename="${path.basename(file.filename, path.extname(file.filename))}.wav"`)
            reply.type('audio/wav')
            reply.send(wav)
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

        ffmpeg(inputBuffer)
            .inputFormat('s16le')
            .audioCodec('pcm_s16le')
            .toFormat('wav')
            .on('end', () => resolve(outputBuffer.getData()))
            .on('error', (err) => reject(err))
            .pipe(outputBuffer, { end: true })

    })
}