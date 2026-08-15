#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_leb128_single_byte_roundtrip() {
        let mut writer = BinaryASTBuffer::new();
        writer.write_varint(42); // Fits in 7 bits (0x2A)

        assert_eq!(writer.stream.len(), 1);

        let mut reader = BinaryASTReader::new(&writer.stream);
        assert_eq!(reader.read_varint(), 42);
    }

    #[test]
    fn test_leb128_multi_byte_roundtrip() {
        let mut writer = BinaryASTBuffer::new();
        let value = 624485; // Requires 3 bytes in LEB128
        writer.write_varint(value);

        assert_eq!(writer.stream.len(), 3);

        let mut reader = BinaryASTReader::new(&writer.stream);
        assert_eq!(reader.read_varint(), value);
    }

    #[test]
    fn test_binary_ast_serialization() {
        let mut writer = BinaryASTBuffer::new();
        writer.serialize_identifier("web4_token");

        let mut reader = BinaryASTReader::new(&writer.stream);
        assert_eq!(reader.read_u8(), ASTOpcode::Identifier as u8);
        assert_eq!(reader.read_string(), "web4_token");
    }
}
