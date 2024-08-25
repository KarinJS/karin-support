import { parentPort, workerData } from 'worker_threads';
import { encode } from 'silk-wasm';

async function convertToSilk() {
    try {
        const inputBuffer = workerData.inputBuffer;
        const silkBuffer = await encode(inputBuffer, 48000);
        parentPort.postMessage({ data: silkBuffer.data });
    } catch (error) {
        parentPort.postMessage({ error: error.message });
    }
}

convertToSilk();
