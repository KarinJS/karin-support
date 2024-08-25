import { Worker } from 'worker_threads';
import { Writable, Readable } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { isSilk } from 'silk-wasm';

const __dirname = dirname(fileURLToPath(import.meta.url));

class AudioConverter {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const { inputBuffer, resolve, reject } = this.queue.shift();

        try {
            const result = await this.convertToWavInternal(inputBuffer);
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.isProcessing = false;
            this.processQueue();
        }
    }

    async convertToWavInternal(inputBuffer) {
        let pcmBuffer = inputBuffer;
        let sampleRate = 48000; // 默认采样率

        if (isSilk(inputBuffer)) {
            const decodeResult = await this.decodeSilk(inputBuffer);
            pcmBuffer = decodeResult.data;
            sampleRate = decodeResult.sampleRate;
        } else {
            sampleRate = await this.detectSampleRate(inputBuffer);
        }

        return new Promise((resolve, reject) => {
            const outputBuffer = new MemoryWritableStream();

            ffmpeg(Readable.from(pcmBuffer))
                .inputFormat('s16le')
                .audioCodec('pcm_s16le')
                .audioFrequency(sampleRate)
                .toFormat('wav')
                .on('end', () => {
                    resolve(outputBuffer.getData());
                    outputBuffer.clearData();
                })
                .on('error', (err) => {
                    outputBuffer.clearData();
                    reject(err);
                })
                .pipe(outputBuffer, { end: true });
        });
    }

    async convertToSilk(inputStream) {
        const inputBuffer = await this.streamToBuffer(inputStream);
        const wavBuffer = await this.convertToWav(inputBuffer);
        
        return new Promise((resolve, reject) => {
            const worker = new Worker(path.resolve(__dirname, './silkWorker.js'), {
                workerData: {
                    inputBuffer: wavBuffer
                }
            });

            worker.on('message', (result) => {
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(Buffer.from(result.data));
                }
                worker.terminate();
            });

            worker.on('error', (error) => {
                worker.terminate();
                reject(error);
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
                worker.terminate();
            });

            setTimeout(() => {
                if (worker) {
                    worker.terminate();
                    reject(new Error('Operation timed out'));
                }
            }, 2 * 60 * 1000); 
        });
    }

    async convertToWav(inputBuffer) {
        return new Promise((resolve, reject) => {
            this.queue.push({ inputBuffer, resolve, reject });
            this.processQueue();
        });
    }

    async decodeSilk(inputBuffer) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(path.resolve(__dirname, './silkDecodeWorker.js'), {
                workerData: { inputBuffer }
            });

            worker.on('message', (result) => {
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve({
                        data: Buffer.from(result.data),
                        sampleRate: result.sampleRate
                    });
                }
                worker.terminate();
            });

            worker.on('error', (error) => {
                worker.terminate();
                reject(error);
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
                worker.terminate();
            });

            setTimeout(() => {
                if (worker) {
                    worker.terminate();
                    reject(new Error('Operation timed out'));
                }
            }, 2 * 60 * 1000);
        });
    }

    async detectSampleRate(inputBuffer) {
        return new Promise((resolve, reject) => {
            ffmpeg(Readable.from(inputBuffer))
                .ffprobe((err, metadata) => {
                    if (err) {
                        return reject(err);
                    }
                    const sampleRate = metadata.streams[0].sample_rate;
                    resolve(parseInt(sampleRate, 10));
                });
        });
    }

    async streamToBuffer(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }
}

class MemoryWritableStream extends Writable {
    constructor() {
        super({ objectMode: true });
        this.chunks = [];
    }

    _write(chunk, encoding, callback) {
        this.chunks.push(chunk);
        callback();
    }

    getData() {
        return Buffer.concat(this.chunks);
    }

    clearData() {
        this.chunks = [];
    }
}

export default AudioConverter;
