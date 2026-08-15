mod lexer;
mod binary_ast;

use wasm_bindgen::prelude::*;
use lexer::{ZeroCopyLexer, TokenKind};
use binary_ast::BinaryASTBuffer;

#[wasm_bindgen]
pub struct Web4ParserEngine {
    buffer: Vec<u8>,
}

#[wasm_bindgen]
impl Web4ParserEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { buffer: Vec::new() }
    }

    pub fn parse_to_binary(&mut self, source: &str) -> *const u8 {
        let mut ast_writer = BinaryASTBuffer::new();
        let mut lexer = ZeroCopyLexer::new(source);

        loop {
            let tok = lexer.next_token();
            if tok.kind == TokenKind::Eof {
                break;
            }
            if tok.kind == TokenKind::Identifier {
                ast_writer.serialize_identifier(tok.slice);
            }
        }

        self.buffer = ast_writer.stream;
        self.buffer.as_ptr()
    }

    pub fn get_buffer_len(&self) -> usize {
        self.buffer.len()
    }
}
