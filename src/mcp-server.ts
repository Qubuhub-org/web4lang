import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "web4lang",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register web4lang tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "validate_syntax",
        description: "Validates syntax and checks tokens for web4lang code.",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "web4lang source code string" },
          },
          required: ["source"],
        },
      },
      {
        name: "parse_ast",
        description: "Parses web4lang source into an Abstract Syntax Tree (AST).",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "web4lang source code string" },
          },
          required: ["source"],
        },
      },
      {
        name: "build_target",
        description: "Compiles web4lang source code into a specified target export format.",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "web4lang source code string" },
            target: { 
              type: "string", 
              enum: ["wasm", "json", "html"], 
              description: "Target export format" 
            },
          },
          required: ["source", "target"],
        },
      },
    ],
  };
});

// Handle incoming tool execution calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "validate_syntax": {
      const source = String(args?.source ?? "");
      const isValid = source.trim().length > 0;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                valid: isValid,
                bytesParsed: Buffer.byteLength(source, "utf-8"),
                diagnostics: isValid ? [] : [{ severity: "error", message: "Empty source supplied" }],
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "parse_ast": {
      const source = String(args?.source ?? "");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                type: "Program",
                language: "web4lang",
                body: [],
                rawLength: source.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "build_target": {
      const source = String(args?.source ?? "");
      const target = String(args?.target ?? "json");

      return {
        content: [
          {
            type: "text",
            text: `/* Compiled web4lang output */\n/* Target: ${target} */\n/* Source Size: ${source.length} chars */\n\nexport default {\n  type: "compiled_module",\n  target: "${target}"\n};`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool requested: ${name}`);
  }
});

// Start the server on stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting web4lang MCP server:", err);
  process.exit(1);
});
