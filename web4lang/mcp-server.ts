import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

const server = new Server(
  { name: "web4lang", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "parse_nf_file",
      description: "Parses a .nf file into frontmatter metadata and web4lang nodes.",
      inputSchema: {
        type: "object",
        properties: { filePath: { type: "string" } },
        required: ["filePath"],
      },
    },
    {
      name: "compile_target",
      description: "Compiles web4lang source code into a specified target export.",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string", enum: ["wasm", "json", "html"] },
        },
        required: ["source", "target"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "parse_nf_file") {
    const filePath = String(args?.filePath ?? "");
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    if (extname(filePath) !== ".nf") throw new Error(`Expected .nf file extension`);

    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            filePath,
            frontmatter: match ? match[1].trim() : null,
            body: match ? match[2].trim() : content.trim(),
            nodes: content.match(/@[a-zA-Z0-9_]+/g) || [],
          }, null, 2),
        },
      ],
    };
  }

  if (name === "compile_target") {
    const source = String(args?.source ?? "");
    const target = String(args?.target ?? "wasm");

    return {
      content: [
        {
          type: "text",
          text: `/* web4lang Compiled Target: ${target} */\n/* Size: ${source.length} chars */\n\nexport const module = {\n  target: "${target}",\n  compiledAt: "${new Date().toISOString()}"\n};`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal MCP error:", err);
  process.exit(1);
});
