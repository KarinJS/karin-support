import { parentPort, workerData } from 'worker_threads';
import { decode } from 'silk-wasm';

(async () => {
    try {
        const inputBuffer = Buffer.from(workerData.inputBuffer);
        const decoded = await decode(inputBuffer);
        parentPort.postMessage({ data: decoded.data, sampleRate: decoded.sampleRate });
    } catch (error) {
        parentPort.postMessage({ error: error.message });
    }
})();
