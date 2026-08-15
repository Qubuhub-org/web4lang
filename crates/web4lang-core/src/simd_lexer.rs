#[cfg(target_arch = "wasm32")]
use core::arch::wasm32::*;

pub struct SimdZeroCopyLexer<'a> {
    source: &'a [u8],
    cursor: usize,
}

impl<'a> SimdZeroCopyLexer<'a> {
    pub fn new(source: &'a str) -> Self {
        Self {
            source: source.as_bytes(),
            cursor: 0,
        }
    }

    /// Fast-forwards past whitespace (space, tab, newline, carriage return) 
    /// 16 bytes at a time using WASM v128 registers.
    #[target_feature(enable = "simd128")]
    pub unsafe fn skip_whitespace_simd(&mut self) {
        let space = u8x16_splat(b' ');
        let tab = u8x16_splat(b'\t');
        let newline = u8x16_splat(b'\n');
        let cr = u8x16_splat(b'\r');

        while self.cursor + 16 <= self.source.len() {
            let ptr = self.source.as_ptr().add(self.cursor) as *const v128;
            let chunk = v128_load(ptr);

            // Parallel byte-by-byte comparison
            let is_space = u8x16_eq(chunk, space);
            let is_tab = u8x16_eq(chunk, tab);
            let is_newline = u8x16_eq(chunk, newline);
            let is_cr = u8x16_eq(chunk, cr);

            // Combine masks with bitwise OR
            let is_ws = v128_or(v128_or(is_space, is_tab), v128_or(is_newline, is_cr));
            let mask = u8x16_bitmask(is_ws);

            if mask == 0xFFFF {
                // Entire 16-byte block is whitespace
                self.cursor += 16;
            } else {
                // Non-whitespace character found -> jump directly to its offset
                let non_ws_mask = !mask & 0xFFFF;
                let offset = non_ws_mask.trailing_zeros() as usize;
                self.cursor += offset;
                return;
            }
        }

        // Scalar tail loop for remaining bytes (< 16)
        while self.cursor < self.source.len() && self.source[self.cursor].is_ascii_whitespace() {
            self.cursor += 1;
        }
    }

    /// Scans contiguous identifier bytes until a delimiter (space, semicolon, or '=') 
    /// is detected inside a 16-byte SIMD vector window.
    #[target_feature(enable = "simd128")]
    pub unsafe fn scan_identifier_simd(&mut self) -> &'a str {
        let start = self.cursor;

        let space = u8x16_splat(b' ');
        let semi = u8x16_splat(b';');
        let assign = u8x16_splat(b'=');

        while self.cursor + 16 <= self.source.len() {
            let ptr = self.source.as_ptr().add(self.cursor) as *const v128;
            let chunk = v128_load(ptr);

            let is_space = u8x16_eq(chunk, space);
            let is_semi = u8x16_eq(chunk, semi);
            let is_assign = u8x16_eq(chunk, assign);

            let is_delim = v128_or(is_space, v128_or(is_semi, is_assign));
            let mask = u8x16_bitmask(is_delim);

            if mask != 0 {
                // Delimiter found within vector window -> find first set bit lane index
                let offset = mask.trailing_zeros() as usize;
                self.cursor += offset;
                return core::str::from_utf8_unchecked(&self.source[start..self.cursor]);
            }

            self.cursor += 16;
        }

        // Scalar tail fallback for remaining bytes
        while self.cursor < self.source.len() {
            let b = self.source[self.cursor];
            if b == b' ' || b == b';' || b == b'=' || b.is_ascii_whitespace() {
                break;
            }
            self.cursor += 1;
        }

        core::str::from_utf8_unchecked(&self.source[start..self.cursor])
    }
}
