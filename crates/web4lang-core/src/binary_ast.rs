use std::convert::TryInto;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ASTOpcode {
    Program    = 0x01,
    VarDecl    = 0x02,
    Identifier = 0x03,
    Number     = 0x04,
    String     = 0x05,
    BinaryOp   = 0x06,
}

pub struct BinaryASTBuffer {
    pub stream: Vec<u8>,
}

impl BinaryASTBuffer {
    pub fn new() -> Self {
        Self { stream: Vec::new() }
    }

    /// Writes an unsigned 32-bit integer using LEB128 variable-length byte packing.
    pub fn write_varint(&mut self, mut value: u32) {
        loop {
            let mut byte = (value & 0x7F) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80; // Set continuation bit
                self.stream.push(byte);
            } else {
                self.stream.push(byte);
                break;
            }
        }
    }

    pub fn write_u8(&mut self, val: u8) {
        self.stream.push(val);
    }

    pub fn write_f64(&mut self, val: f64) {
        self.stream.extend_from_slice(&val.to_bits().to_le_bytes());
    }

    pub fn write_string(&mut self, val: &str) {
        let bytes = val.as_bytes();
        self.write_varint(bytes.len() as u32);
        self.stream.extend_from_slice(bytes);
    }

    pub fn serialize_identifier(&mut self, name: &str) {
        self.write_u8(ASTOpcode::Identifier as u8);
        self.write_string(name);
    }

    pub fn serialize_var_decl(&mut self, id: &str, num_val: f64) {
        self.write_u8(ASTOpcode::VarDecl as u8);
        self.write_string(id);
        self.write_u8(ASTOpcode::Number as u8);
        self.write_f64(num_val);
    }
}

pub struct BinaryASTReader<'a> {
    buffer: &'a [u8],
    cursor: usize,
}

impl<'a> BinaryASTReader<'a> {
    pub fn new(buffer: &'a [u8]) -> Self {
        Self { buffer, cursor: 0 }
    }

    /// Reads an LEB128 variable-length decoded u32 integer.
    pub fn read_varint(&mut self) -> u32 {
        let mut result: u32 = 0;
        let mut shift = 0;
        loop {
            let byte = self.buffer[self.cursor];
            self.cursor += 1;
            result |= ((byte & 0x7F) as u32) << shift;
            if (byte & 0x80) == 0 {
                break;
            }
            shift += 7;
        }
        result
    }

    pub fn read_u8(&mut self) -> u8 {
        let val = self.buffer[self.cursor];
        self.cursor += 1;
        val
    }

    pub fn read_f64(&mut self) -> f64 {
        let bytes = &self.buffer[self.cursor..self.cursor + 8];
        self.cursor += 8;
        f64::from_bits(u64::from_le_bytes(bytes.try_into().unwrap()))
    }

    pub fn read_string(&mut self) -> String {
        let len = self.read_varint() as usize;
        let str_bytes = &self.buffer[self.cursor..self.cursor + len];
        self.cursor += len;
        String::from_utf8(str_bytes.to_vec()).unwrap()
    }
}
