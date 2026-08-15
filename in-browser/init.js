import init, { Web4ParserEngine } from './pkg/web4_parser.js';

async function executePipeline() {
  const wasm = await init();
  const engine = new Web4ParserEngine();

  const source = 'let alpha = 42.0; let beta = 100.5;';
  
  // 1. Execute WASM binary parser
  const ptr = engine.parse_to_binary(source);
  const len = engine.get_buffer_len();

  // 2. Access shared memory directly without string copy overhead
  const binaryAST = new Uint8Array(wasm.memory.buffer, ptr, len);

  console.log(`Successfully generated binary AST (${len} bytes):`, binaryAST);
}
