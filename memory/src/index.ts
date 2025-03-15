#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  CallToolRequest,
  InitializeRequest
} from "@modelcontextprotocol/sdk/types.js";
import * as config from './utils/config.js';
import { KnowledgeGraphManager } from './core/KnowledgeGraphManager.js';

// Initialize server
const server = new Server(
  {
    name: "mcp-memory",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Initialize knowledge graph manager
let knowledgeGraphManager: KnowledgeGraphManager | null = null;

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_entities",
        description: "Create multiple new entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The name of the entity" },
                  entityType: { type: "string", description: "The type of the entity" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents associated with the entity"
                  },
                },
                required: ["name", "entityType", "observations"],
              },
            },
          },
          required: ["entities"],
        },
      },
      {
        name: "create_relations",
        description: "Create multiple new relations between entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
              },
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on a query",
        inputSchema: {
          type: "object",
          properties: {
            query: { 
              type: "string", 
              description: "The search query to match against entity names, types, and observation content" 
            },
            pagination: {
              type: "object",
              properties: {
                offset: { type: "number", description: "Starting position for results" },
                limit: { type: "number", description: "Maximum number of results to return" }
              },
              required: [],
            }
          },
          required: ["query"],
        },
      },
      {
        name: "get_related_nodes",
        description: "Get all nodes related to a starting node up to a specified depth",
        inputSchema: {
          type: "object",
          properties: {
            startingNodeName: {
              type: "string",
              description: "The name of the entity to start from"
            },
            depth: {
              type: "number",
              description: "How many relationship hops to traverse"
            }
          },
          required: ["startingNodeName"],
        },
      },
      {
        name: "get_graph_stats",
        description: "Get statistics about the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  if (!knowledgeGraphManager) {
    throw new Error("Knowledge graph manager is not initialized");
  }

  try {
    switch (name) {
      case "create_entities": {
        if (!args?.entities || !Array.isArray(args.entities)) {
          throw new Error("Missing or invalid entities argument");
        }
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(await knowledgeGraphManager.createEntities(args.entities), null, 2) 
          }] 
        };
      }

      case "create_relations": {
        if (!args?.relations || !Array.isArray(args.relations)) {
          throw new Error("Missing or invalid relations argument");
        }
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(await knowledgeGraphManager.createRelations(args.relations), null, 2) 
          }] 
        };
      }

      case "search_nodes": {
        if (typeof args?.query !== 'string') {
          throw new Error("Missing or invalid query argument");
        }
        
        let pagination = { offset: 0, limit: 20 };
        if (args.pagination && typeof args.pagination === 'object') {
          const { offset, limit } = args.pagination as { offset?: unknown; limit?: unknown };
          if (typeof offset === 'number' && typeof limit === 'number') {
            pagination = { offset, limit };
          }
        }
        
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(await knowledgeGraphManager.searchNodes(
              args.query,
              pagination
            ), null, 2) 
          }] 
        };
      }

      case "get_related_nodes": {
        if (typeof args?.startingNodeName !== 'string') {
          throw new Error("Missing or invalid startingNodeName argument");
        }
        const depth = typeof args.depth === 'number' ? args.depth : 1;
        
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(await knowledgeGraphManager.getRelatedNodes(
              args.startingNodeName,
              depth
            ), null, 2) 
          }] 
        };
      }

      case "get_graph_stats":
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(await knowledgeGraphManager.getGraphStats(), null, 2) 
          }] 
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    throw error;
  }
});

// Handle initialization
server.setRequestHandler(InitializeRequestSchema, async (request: InitializeRequest) => {
  try {
    console.error("Initializing memory server with protocol version:", request.params.protocolVersion);
    
    // Load configuration
    await config.load();
    
    // Initialize knowledge graph manager
    knowledgeGraphManager = new KnowledgeGraphManager();
    knowledgeGraphManager.setMemoryFilePath(config.get('memoryFilePath'));
    
    return {
      serverInfo: {
        name: "mcp-memory",
        version: "1.1.0"
      },
      capabilities: {
        tools: {}
      }
    };
  } catch (error) {
    console.error("Error during initialization:", error);
    throw error;
  }
});

// Main function to handle server startup
async function main() {
  try {
    console.error("Starting MCP Memory Server...");
    
    // Initialize transport
    const transport = new StdioServerTransport();
    
    // Connect to transport
    await server.connect(transport);
    
    console.error("Server initialized and ready to accept requests");
    
  } catch (error) {
    console.error("Fatal error during server initialization:", error);
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGINT', async () => {
  console.error("\nReceived SIGINT signal, shutting down...");
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error("Received SIGTERM signal, shutting down...");
  await server.close();
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 