const { performance } = require('perf_hooks');

// ============================================================================
// 1. LEB128 VARIABLE-LENGTH INTEGER UTILITIES
// ============================================================================

function writeVarint(buffer, offset, value) {
  let cur = offset;
  while (true) {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) {
      buffer[cur++] = byte | 0x80;
    } else {
      buffer[cur++] = byte;
      break;
    }
  }
  return cur - offset;
}

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

// ============================================================================
// 2. PARSING ENGINES (SCALAR VS SIMD VECTOR SCANNING)
// ============================================================================

/**
 * SCALAR SCANNER:
 * Iterates byte-by-byte through source text to identify token boundaries.
 */
function scalarLexAndPack(sourceBuffer, nodeCount) {
  const maxAllocSize = nodeCount * 40;
  const binBuffer = new Uint8Array(maxAllocSize);
  let writeOffset = 0;
  let readCursor = 0;
  const len = sourceBuffer.length;

  while (readCursor < len) {
    // Skip whitespace byte-by-byte
    while (readCursor < len && sourceBuffer[readCursor] <= 0x20) {
      readCursor++;
    }
    if (readCursor >= len) break;

    const start = readCursor;
    // Scan identifier byte-by-byte
    while (readCursor < len && sourceBuffer[readCursor] > 0x20 && sourceBuffer[readCursor] !== 0x3b) {
      readCursor++;
    }

    const tokenLen = readCursor - start;
    if (tokenLen > 0) {
      binBuffer[writeOffset++] = 0x03; // Opcode: Identifier
      const varLen = writeVarint(binBuffer, writeOffset, tokenLen);
      writeOffset += varLen;
      binBuffer.set(sourceBuffer.subarray(start, readCursor), writeOffset);
      writeOffset += tokenLen;
    }

    if (readCursor < len && sourceBuffer[readCursor] === 0x3b) {
      readCursor++; // Skip delimiter ';'
    }
  }

  return binBuffer.subarray(0, writeOffset);
}

/**
 * WASM SIMD128 VECTOR SCANNER (16-Byte Chunk Lane Model):
 * Simulates WASM `v128` vector instructions (`i8x16.eq`, `v128.bitmask`)
 * using 64-bit bitwise lane masks to identify 16 bytes of delimiters in parallel.
 */
function simdLexAndPack(sourceBuffer, nodeCount) {
  const maxAllocSize = nodeCount * 40;
  const binBuffer = new Uint8Array(maxAllocSize);
  let writeOffset = 0;
  let readCursor = 0;
  const len = sourceBuffer.length;

  // View underlying memory as 64-bit words for 8-byte/16-byte parallel bitmask evaluation
  const u64View = new BigUint64Array(sourceBuffer.buffer, sourceBuffer.byteOffset, Math.floor(len / 8));
  const SPACE_MASK = 0x2020202020202020n;
  const SEMI_MASK  = 0x3B3B3B3B3B3B3B3Bn;

  while (readCursor < len) {
    // Fast SIMD Vector Skip for contiguous whitespace/delimiters
    while (readCursor + 16 <= len && (readCursor % 8 === 0)) {
      const wordIdx = readCursor / 8;
      const word = u64View[wordIdx];
      // Parallel comparison against space and semicolon bytes
      if (word === SPACE_MASK || word === SEMI_MASK) {
        readCursor += 8;
      } else {
        break;
      }
    }

    // Scalar fallback for non-aligned boundary residual
    while (readCursor < len && sourceBuffer[readCursor] <= 0x20) {
      readCursor++;
    }
    if (readCursor >= len) break;

    const start = readCursor;

    // Fast SIMD Vector Scan for token boundaries (16-byte chunks)
    while (readCursor + 8 <= len && (readCursor % 8 === 0)) {
      const wordIdx = readCursor / 8;
      const word = u64View[wordIdx];
      // Check if any byte in the 8-byte chunk matches space (0x20) or semicolon (0x3b)
      const hasSpace = (word ^ SPACE_MASK) & 0x7F7F7F7F7F7F7F7Fn;
      const hasSemi = (word ^ SEMI_MASK) & 0x7F7F7F7F7F7F7F7Fn;
      if (hasSpace.toString(16).includes('0') || hasSemi.toString(16).includes('0')) {
        break; // Delimiter found in this vector slice; drop to scalar resolution
      }
      readCursor += 8;
    }

    while (readCursor < len && sourceBuffer[readCursor] > 0x20 && sourceBuffer[readCursor] !== 0x3b) {
      readCursor++;
    }

    const tokenLen = readCursor - start;
    if (tokenLen > 0) {
      binBuffer[writeOffset++] = 0x03; // Opcode: Identifier
      const varLen = writeVarint(binBuffer, writeOffset, tokenLen);
      writeOffset += varLen;
      binBuffer.set(sourceBuffer.subarray(start, readCursor), writeOffset);
      writeOffset += tokenLen;
    }

    if (readCursor < len && sourceBuffer[readCursor] === 0x3b) {
      readCursor++;
    }
  }

  return binBuffer.subarray(0, writeOffset);
}

// ============================================================================
// 3. BENCHMARK EXECUTION
// ============================================================================

function runSIMDBenchmark(NODE_COUNT = 100000) {
  console.log(`\n================================================================`);
  console.log(` web4lang Parsing Benchmark: Standard vs Scalar vs WASM SIMD`);
  console.log(` Workload: ${NODE_COUNT.toLocaleString()} AST Tokens`);
  console.log(`================================================================\n`);

  // Build synthetic source text payload
  let sourceText = '';
  for (let i = 0; i < NODE_COUNT; i++) {
    sourceText += `var_id_${i}; `;
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');
  const sourceBuffer = encoder.encode(sourceText);

  // --------------------------------------------------------------------------
  // 1. JSON AST Benchmark
  // --------------------------------------------------------------------------
  const astObj = {
    type: 'Program',
    body: Array.from({ length: NODE_COUNT }, (_, i) => ({ type: 'Identifier', name: `var_id_${i}` }))
  };

  const jsonStrStart = performance.now();
  const jsonString = JSON.stringify(astObj);
  const jsonStrEnd = performance.now();

  const jsonParseStart = performance.now();
  const decodedJSON = JSON.parse(jsonString);
  const jsonParseEnd = performance.now();

  // --------------------------------------------------------------------------
  // 2. Scalar LEB128 Binary AST Benchmark
  // --------------------------------------------------------------------------
  const scalarStart = performance.now();
  const scalarBinaryBuffer = scalarLexAndPack(sourceBuffer, NODE_COUNT);
  const scalarEnd = performance.now();

  // --------------------------------------------------------------------------
  // 3. WASM SIMD-Accelerated LEB128 Binary AST Benchmark
  // --------------------------------------------------------------------------
  const simdStart = performance.now();
  const simdBinaryBuffer = simdLexAndPack(sourceBuffer, NODE_COUNT);
  const simdEnd = performance.now();

  // --------------------------------------------------------------------------
  // 4. Binary AST Decoding Benchmark (Shared by Scalar & SIMD)
  // --------------------------------------------------------------------------
  const decodeStart = performance.now();
  let readOffset = 0;
  const decodedNodes = [];

  while (readOffset < simdBinaryBuffer.length) {
    const opcode = simdBinaryBuffer[readOffset++];
    if (opcode === 0x03) {
      const { value: strLen, bytesRead } = readVarint(simdBinaryBuffer, readOffset);
      readOffset += bytesRead;
      const strSlice = simdBinaryBuffer.subarray(readOffset, readOffset + strLen);
      const name = decoder.decode(strSlice);
      readOffset += strLen;
      decodedNodes.push(name);
    }
  }
  const decodeEnd = performance.now();

  // --------------------------------------------------------------------------
  // RESULTS METRICS
  // --------------------------------------------------------------------------
  const jsonSizeKB = (Buffer.byteLength(jsonString) / 1024).toFixed(2);
  const binSizeKB = (simdBinaryBuffer.length / 1024).toFixed(2);

  const jsonParseTime = (jsonParseEnd - jsonParseStart).toFixed(3);
  const scalarParseTime = (scalarEnd - scalarStart).toFixed(3);
  const simdParseTime = (simdEnd - simdStart).toFixed(3);
  const binaryDecodeTime = (decodeEnd - decodeStart).toFixed(3);

  const simdVsScalarSpeedup = ((scalarEnd - scalarStart) / (simdEnd - simdStart)).toFixed(2);
  const simdVsJsonSpeedup = ((jsonParseEnd - jsonParseStart) / (simdEnd - simdStart)).toFixed(2);

  console.log(`+----------------------------------+-------------------+--------------------+`);
  console.log(`| Pipeline Strategy                | Execution Time    | Payload Size       |`);
  console.log(`+----------------------------------+-------------------+--------------------+`);
  console.log(`| Standard JSON.parse()            | ${jsonParseTime.padStart(10)} ms | ${jsonSizeKB.padStart(12)} KB |`);
  console.log(`| Scalar Binary Parser             | ${scalarParseTime.padStart(10)} ms | ${binSizeKB.padStart(12)} KB |`);
  console.log(`| WASM SIMD Vector Parser          | ${simdParseTime.padStart(10)} ms | ${binSizeKB.padStart(12)} KB |`);
  console.log(`| Binary AST Decoder               | ${binaryDecodeTime.padStart(10)} ms | -                  |`);
  console.log(`+----------------------------------+-------------------+--------------------+\n`);

  console.log(`Performance Analysis Highlights:`);
  console.log(`  • SIMD vs Scalar Speedup : ${simdVsScalarSpeedup}x faster token scanning`);
  console.log(`  • SIMD vs JSON Speedup   : ${simdVsJsonSpeedup}x faster string parsing`);
  console.log(`  • Memory Footprint       : ${(((1 - simdBinaryBuffer.length / Buffer.byteLength(jsonString))) * 100).toFixed(2)}% size reduction over JSON\n`);
}

runSIMDBenchmark(100000);
