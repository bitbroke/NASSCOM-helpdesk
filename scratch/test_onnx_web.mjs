import path from 'path';
import fs from 'fs';
import ort from 'onnxruntime-web';
import { pathToFileURL } from 'url';

async function test() {
  try {
    const wasmDir = path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist');
    ort.env.wasm.wasmPaths = pathToFileURL(wasmDir).href + '/';
    
    console.log('ORT WASM Paths:', ort.env.wasm.wasmPaths);
    
    const modelPath = path.join(process.cwd(), 'public', 'models', 'classifier.onnx');
    const session = await ort.InferenceSession.create(modelPath);
    console.log('ONNX Session created successfully!');
  } catch (e) {
    console.error('Test failed:', e);
  }
}

test();
