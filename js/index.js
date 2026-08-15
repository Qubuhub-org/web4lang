import init, { Web4ParserEngine } from './pkg/web4lang_core.js';

/**
 * Decodes an LEB128 variable-length integer from a Uint8Array byte stream.
 */
function readVarint(buffer, offset) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;

  while (true) {
    const byte = buffer[offset + bytesRead];
    bytesRead++;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  return { value: result, bytesRead };
}

/**
 * Decodes the custom binary AST stream directly from WASM Shared Memory.
 */
function decodeBinaryAST(buffer) {
  const textDecoder = new TextDecoder('utf-8');
  let offset = 0;
  const nodes = [];

  while (offset < buffer.length) {
    const opcode = buffer[offset++];
    
    // Opcode 0x03: Identifier Node
    if (opcode === 0x03) {
      const { value: strLen, bytesRead } = readVarint(buffer, offset);
      offset += bytesRead;

      const strBytes = buffer.subarray(offset, offset + strLen);
      const name = textDecoder.decode(strBytes);
      offset += strLen;

      nodes.push({ type: 'Identifier', name });
    }
  }

  return nodes;
}

export async function runPipeline(sourceCode) {
  const wasm = await init();
  const engine = new Web4ParserEngine();

  // Parse directly in WASM execution layer
  const ptr = engine.parse_to_binary(sourceCode);
  const len = engine.get_buffer_len();

  // Zero-copy read directly from WASM memory pool
  const binaryMemory = new Uint8Array(wasm.memory.buffer, ptr, len);
  
  // Decode packed LEB128 binary AST
  const ast = decodeBinaryAST(binaryMemory);
  return ast;
}
