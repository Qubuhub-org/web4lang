import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

// Add to tool definitions in ListToolsRequestSchema
const nfToolDefinition = {
  name: "parse_nf_file",
  description: "Reads and parses a .nf schema/document file into Frontmatter and AST representation.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Absolute path to the .nf file" },
    },
    required: ["filePath"],
  },
};

// Add to CallToolRequestSchema switch block
case "parse_nf_file": {
  const filePath = String(args?.filePath ?? "");

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (extname(filePath) !== ".nf") {
    throw new Error(`Invalid file extension. Expected .nf, got ${extname(filePath)}`);
  }

  const rawContent = readFileSync(filePath, "utf-8");
  
  // Basic Frontmatter & Body splitting for .nf format
  const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  const metadata = frontmatterMatch ? frontmatterMatch[1] : "";
  const body = frontmatterMatch ? frontmatterMatch[2] : rawContent;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            status: "success",
            file: filePath,
            hasFrontmatter: Boolean(frontmatterMatch),
            metadataRaw: metadata,
            bodyRaw: body.trim(),
            parsedNodes: body.match(/@[a-zA-Z0-9_]+/g) || [],
          },
          null,
          2
        ),
      },
    ],
  };
}
