#!/usr/bin/env node

// This is an enhanced version of the MCP Memory Server with the following improvements:
// 1. Added UUID for each entity and relation
// 2. Added creation timestamps and update timestamps
// 3. Implemented pagination for reading and searching
// 4. Added more robust filtering options
// 5. Maintained compatibility with existing API


import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import * as config from './config.js';

// Set DEBUG_CONFIG env var if needed
 process.env.DEBUG_CONFIG = 'true';


// Enhanced interfaces with UUID and timestamps
interface BaseRecord {
  uuid: string;
  createdAt: string;
  updatedAt: string;
}

interface Entity extends BaseRecord {
  name: string;
  entityType: string;
  observations: string[];
}

interface Relation extends BaseRecord {
  from: string;
  to: string;
  relationType: string;
}

interface KnowledgeGraph {
  entries: Entity[];
  relations: Relation[];
}

interface PaginationOptions {
  offset: number;
  limit: number;
}

interface FilterOptions {
  entityTypes?: string[];
  relationTypes?: string[];
  fromDate?: string;
  toDate?: string;
  searchText?: string;
}

interface PaginatedResponse<T> {
  items: T;
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

// Helper to generate UUID
function generateUUID(): string {
  return crypto.randomUUID();
}

// Helper to get current ISO timestamp
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// The KnowledgeGraphManager class contains all operations to interact with the knowledge graph
class KnowledgeGraphManager {
  private memoryFilePath: string | null = null;
  
  /**
   * Sets the memory file path to be used for operations
   */
  setMemoryFilePath(filePath: string): void {
    console.error(`Setting memory file path to: ${filePath}`);
    this.memoryFilePath = filePath;
  }
  
  /**
   * Gets the configured memory file path
   */
  getMemoryFilePath(): string {
    if (!this.memoryFilePath) {
      throw new Error('Memory file path not set. Configuration may not be loaded.');
    }
    return this.memoryFilePath;
  }
  
  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.getMemoryFilePath(), "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      
      return lines.reduce((graph: KnowledgeGraph, line) => {
        try {
          const item = JSON.parse(line);
          
          // Handle legacy data without uuid and timestamps
          if (item.type === "entity") {
            if (!item.uuid) {
              item.uuid = generateUUID();
              item.createdAt = getCurrentTimestamp();
              item.updatedAt = getCurrentTimestamp();
            }
            graph.entries.push(item as Entity);
          }
          
          if (item.type === "relation") {
            if (!item.uuid) {
              item.uuid = generateUUID();
              item.createdAt = getCurrentTimestamp();
              item.updatedAt = getCurrentTimestamp();
            }
            graph.relations.push(item as Relation);
          }
          
          return graph;
        } catch (e) {
          console.error("Error parsing line:", line, e);
          return graph;
        }
      }, { entries: [], relations: [] });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return { entries: [], relations: [] };
      }
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entries.map(e => JSON.stringify({ type: "entity", ...e })),
      ...graph.relations.map(r => JSON.stringify({ type: "relation", ...r })),
    ];
    await fs.writeFile(this.getMemoryFilePath(), lines.join("\n"));
  }

  // Create entities with UUID and timestamps
  async createEntities(entities: Omit<Entity, keyof BaseRecord>[]): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const timestamp = getCurrentTimestamp();
    
    const newEntities = entities
      .filter(e => !graph.entries.some(existingEntity => existingEntity.name === e.name))
      .map(entity => ({
        ...entity,
        uuid: generateUUID(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));
    
    graph.entries.push(...newEntities);
    await this.saveGraph(graph);
    return newEntities;
  }

  // Create relations with UUID and timestamps
  async createRelations(relations: Omit<Relation, keyof BaseRecord>[]): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const timestamp = getCurrentTimestamp();
    
    const newRelations = relations
      .filter(r => !graph.relations.some(existingRelation => 
        existingRelation.from === r.from && 
        existingRelation.to === r.to && 
        existingRelation.relationType === r.relationType
      ))
      .map(relation => ({
        ...relation,
        uuid: generateUUID(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));
    
    graph.relations.push(...newRelations);
    await this.saveGraph(graph);
    return newRelations;
  }

  // Add observations with updated timestamp
  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const timestamp = getCurrentTimestamp();
    const results = observations.map(o => {
      const entity = graph.entries.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      
      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
      entity.observations.push(...newObservations);
      
      // Update timestamp when observations are added
      if (newObservations.length > 0) {
        entity.updatedAt = timestamp;
      }
      
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    
    await this.saveGraph(graph);
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.entries = graph.entries.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    await this.saveGraph(graph);
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    const graph = await this.loadGraph();
    const timestamp = getCurrentTimestamp();
    
    deletions.forEach(d => {
      const entity = graph.entries.find(e => e.name === d.entityName);
      if (entity) {
        const initialLength = entity.observations.length;
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
        
        // Update timestamp only if observations were actually deleted
        if (entity.observations.length !== initialLength) {
          entity.updatedAt = timestamp;
        }
      }
    });
    
    await this.saveGraph(graph);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.relations = graph.relations.filter(r => !relations.some(delRelation => 
      r.from === delRelation.from && 
      r.to === delRelation.to && 
      r.relationType === delRelation.relationType
    ));
    await this.saveGraph(graph);
  }

  // Enhanced read_graph with pagination and filtering
  async readGraph(
    pagination: PaginationOptions = { offset: 0, limit: 1000 },
    filter: FilterOptions = {}
  ): Promise<PaginatedResponse<KnowledgeGraph>> {
    const graph = await this.loadGraph();
    
    // Apply entity filters
    let filteredEntities = graph.entries;
    
    if (filter.entityTypes && filter.entityTypes.length > 0) {
      filteredEntities = filteredEntities.filter(e => filter.entityTypes!.includes(e.entityType));
    }
    
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filteredEntities = filteredEntities.filter(e => 
        e.name.toLowerCase().includes(searchLower) || 
        e.entityType.toLowerCase().includes(searchLower) || 
        e.observations.some(o => o.toLowerCase().includes(searchLower))
      );
    }
    
    if (filter.fromDate) {
      filteredEntities = filteredEntities.filter(e => new Date(e.updatedAt) >= new Date(filter.fromDate!));
    }
    
    if (filter.toDate) {
      filteredEntities = filteredEntities.filter(e => new Date(e.updatedAt) <= new Date(filter.toDate!));
    }
    
    // Apply relation filters
    let filteredRelations = graph.relations;
    
    if (filter.relationTypes && filter.relationTypes.length > 0) {
      filteredRelations = filteredRelations.filter(r => filter.relationTypes!.includes(r.relationType));
    }
    
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filteredRelations = filteredRelations.filter(r => 
        r.from.toLowerCase().includes(searchLower) || 
        r.to.toLowerCase().includes(searchLower) || 
        r.relationType.toLowerCase().includes(searchLower)
      );
    }
    
    if (filter.fromDate) {
      filteredRelations = filteredRelations.filter(r => new Date(r.updatedAt) >= new Date(filter.fromDate!));
    }
    
    if (filter.toDate) {
      filteredRelations = filteredRelations.filter(r => new Date(r.updatedAt) <= new Date(filter.toDate!));
    }
    
    // Apply pagination
    const totalEntities = filteredEntities.length;
    const totalRelations = filteredRelations.length;
    
    const paginatedEntities = filteredEntities.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );
    
    const paginatedRelations = filteredRelations.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );
    
    const hasMoreEntities = pagination.offset + pagination.limit < totalEntities;
    const hasMoreRelations = pagination.offset + pagination.limit < totalRelations;
    const hasMore = hasMoreEntities || hasMoreRelations;
    
    return {
      items: {
        entries: paginatedEntities,
        relations: paginatedRelations
      } as KnowledgeGraph,
      total: Math.max(totalEntities, totalRelations),
      hasMore,
      nextOffset: hasMore ? pagination.offset + pagination.limit : undefined
    };
  }

  // Enhanced search function with pagination and highlighting
  async searchNodes(
    query: string,
    pagination: PaginationOptions = { offset: 0, limit: 20 }
  ): Promise<PaginatedResponse<KnowledgeGraph>> {
    const graph = await this.loadGraph();
    const queryLower = query.toLowerCase();
    
    // Filter entities
    const matchedEntities = graph.entries.filter(e => 
      e.name.toLowerCase().includes(queryLower) ||
      e.entityType.toLowerCase().includes(queryLower) ||
      e.observations.some(o => o.toLowerCase().includes(queryLower))
    );
    
    // Create a Set of matched entity names for quick lookup
    const matchedEntityNames = new Set(matchedEntities.map(e => e.name));
    
    // Filter relations to only include those between matched entities
    const matchedRelations = graph.relations.filter(r => 
      r.from.toLowerCase().includes(queryLower) ||
      r.to.toLowerCase().includes(queryLower) ||
      r.relationType.toLowerCase().includes(queryLower) ||
      (matchedEntityNames.has(r.from) && matchedEntityNames.has(r.to))
    );
    
    // Apply pagination
    const totalEntities = matchedEntities.length;
    const totalRelations = matchedRelations.length;
    
    const paginatedEntities = matchedEntities.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );
    
    const paginatedRelations = matchedRelations.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );
    
    const hasMoreEntities = pagination.offset + pagination.limit < totalEntities;
    const hasMoreRelations = pagination.offset + pagination.limit < totalRelations;
    const hasMore = hasMoreEntities || hasMoreRelations;
    
    return {
      items: {
        entries: paginatedEntities,
        relations: paginatedRelations
      } as KnowledgeGraph,
      total: Math.max(totalEntities, totalRelations),
      hasMore,
      nextOffset: hasMore ? pagination.offset + pagination.limit : undefined
    };
  }

  // Enhanced open_nodes with complete relation fetching
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    
    // Filter entities
    const filteredEntities = graph.entries.filter(e => names.includes(e.name));
  
    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
  
    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r => 
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );
  
    const filteredGraph: KnowledgeGraph = {
      entries: filteredEntities,
      relations: filteredRelations,
    };
  
    return filteredGraph;
  }
  
  // Get related nodes up to a certain depth
  async getRelatedNodes(startingNodeName: string, depth: number = 1): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const relatedEntityNames = new Set<string>([startingNodeName]);
    
    // BFS to find related nodes up to specified depth
    let currentDepth = 0;
    let nodesToProcess = [startingNodeName];
    
    while (currentDepth < depth && nodesToProcess.length > 0) {
      const nextLevelNodes: string[] = [];
      
      for (const nodeName of nodesToProcess) {
        // Find all relations involving this node
        const relatedRelations = graph.relations.filter(r => r.from === nodeName || r.to === nodeName);
        
        for (const relation of relatedRelations) {
          // Add both ends of the relation
          if (!relatedEntityNames.has(relation.from)) {
            relatedEntityNames.add(relation.from);
            nextLevelNodes.push(relation.from);
          }
          
          if (!relatedEntityNames.has(relation.to)) {
            relatedEntityNames.add(relation.to);
            nextLevelNodes.push(relation.to);
          }
        }
      }
      
      nodesToProcess = nextLevelNodes;
      currentDepth++;
    }
    
    
    // Filter entities and relations
    const filteredEntities = graph.entries.filter(e => relatedEntityNames.has(e.name));
    const filteredRelations = graph.relations.filter(r => 
      relatedEntityNames.has(r.from) && relatedEntityNames.has(r.to)
    );
    
    return {
      entries: filteredEntities,
      relations: filteredRelations
    };
  }
  
  // Get entity types summary
  async getEntityTypesSummary(): Promise<{ type: string; count: number }[]> {
    const graph = await this.loadGraph();
    const typeCounts = new Map<string, number>();
    
    for (const entity of graph.entries) {
      const count = typeCounts.get(entity.entityType) || 0;
      typeCounts.set(entity.entityType, count + 1);
    }
    
    return Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count }));
  }
  
  // Get relation types summary
  async getRelationTypesSummary(): Promise<{ type: string; count: number }[]> {
    const graph = await this.loadGraph();
    const typeCounts = new Map<string, number>();
    
    for (const relation of graph.relations) {
      const count = typeCounts.get(relation.relationType) || 0;
      typeCounts.set(relation.relationType, count + 1);
    }
    
    return Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count }));
  }
  
  // Get graph statistics
  async getGraphStats(): Promise<{ 
    entityCount: number; 
    relationCount: number; 
    observationCount: number;
    lastUpdated: string;
  }> {
    const graph = await this.loadGraph();
    
    const observationCount = graph.entries.reduce(
      (total, entity) => total + entity.observations.length, 
      0
    );
    
    // Find the most recent update timestamp
    const allTimestamps = [
      ...graph.entries.map(e => e.updatedAt),
      ...graph.relations.map(r => r.updatedAt)
    ];
    
    const lastUpdated = allTimestamps.length > 0 
      ? new Date(Math.max(...allTimestamps.map(ts => new Date(ts).getTime()))).toISOString()
      : "N/A";
    
    return {
      entityCount: graph.entries.length,
      relationCount: graph.relations.length,
      observationCount,
      lastUpdated
    };
  }
}

// Create a singleton instance holder for KnowledgeGraphManager
let knowledgeGraphManager: KnowledgeGraphManager | null = null;

// Update the server initialization
const server = new Server(
  {
    name: "agent-memory",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

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
        description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
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
        name: "add_observations",
        description: "Add new observations to existing entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add the observations to" },
                  contents: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents to add"
                  },
                },
                required: ["entityName", "contents"],
              },
            },
          },
          required: ["observations"],
        },
      },
      {
        name: "delete_entities",
        description: "Delete multiple entities and their associated relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: { 
              type: "array", 
              items: { type: "string" },
              description: "An array of entity names to delete" 
            },
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "Delete specific observations from entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity containing the observations" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observations to delete"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "Delete multiple relations from the knowledge graph",
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
              description: "An array of relations to delete" 
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "read_graph",
        description: "Read the entire knowledge graph with pagination and filtering options",
        inputSchema: {
          type: "object",
          properties: {
            pagination: {
              type: "object",
              properties: {
                offset: { type: "number", description: "Starting position for results (default: 0)" },
                limit: { type: "number", description: "Maximum number of results to return (default: 1000)" }
              },
              required: [],
              description: "Pagination options for large result sets"
            },
            filter: {
              type: "object",
              properties: {
                entityTypes: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Filter by entity types" 
                },
                relationTypes: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Filter by relation types" 
                },
                fromDate: {
                  type: "string",
                  description: "Filter by entries updated on or after this date (ISO format)"
                },
                toDate: {
                  type: "string",
                  description: "Filter by entries updated on or before this date (ISO format)"
                },
                searchText: {
                  type: "string",
                  description: "Text to search in names, types, and observations"
                }
              },
              required: [],
              description: "Filtering options"
            }
          },
        },
      },
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on a query with pagination",
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
                offset: { type: "number", description: "Starting position for results (default: 0)" },
                limit: { type: "number", description: "Maximum number of results to return (default: 20)" }
              },
              required: [],
              description: "Pagination options for search results"
            }
          },
          required: ["query"],
        },
      },
      {
        name: "open_nodes",
        description: "Open specific nodes in the knowledge graph by their names",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to retrieve",
            },
          },
          required: ["names"],
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
              description: "How many relationship hops to traverse (default: 1)"
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
      },
      {
        name: "get_entity_types_summary",
        description: "Get a summary of entity types and their counts",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_relation_types_summary",
        description: "Get a summary of relation types and their counts",
        inputSchema: {
          type: "object",
          properties: {},
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (args === undefined && name !== "get_graph_stats" && name !== "get_entity_types_summary" && name !== "get_relation_types_summary") {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  // Check if knowledge graph manager is initialized
  if (!knowledgeGraphManager) {
    throw new Error("Knowledge graph manager is not initialized. Server might not be fully initialized yet.");
  }

  try {
    switch (name) {
      case "create_entities":
        if (!args?.entities) throw new Error("Missing entities argument");
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createEntities(args.entities as Omit<Entity, keyof BaseRecord>[]), null, 2) }] };
      case "create_relations":
        if (!args?.relations) throw new Error("Missing relations argument");
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createRelations(args.relations as Omit<Relation, keyof BaseRecord>[]), null, 2) }] };
      case "add_observations":
        if (!args?.observations) throw new Error("Missing observations argument");
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addObservations(args.observations as { entityName: string; contents: string[] }[]), null, 2) }] };
      case "delete_entities":
        if (!args?.entityNames) throw new Error("Missing entityNames argument");
        await knowledgeGraphManager.deleteEntities(args.entityNames as string[]);
        return { content: [{ type: "text", text: "Entities deleted successfully" }] };
      case "delete_observations":
        if (!args?.deletions) throw new Error("Missing deletions argument");
        await knowledgeGraphManager.deleteObservations(args.deletions as { entityName: string; observations: string[] }[]);
        return { content: [{ type: "text", text: "Observations deleted successfully" }] };
      case "delete_relations":
        if (!args?.relations) throw new Error("Missing relations argument");
        await knowledgeGraphManager.deleteRelations(args.relations as Relation[]);
        return { content: [{ type: "text", text: "Relations deleted successfully" }] };
      case "read_graph":
        const pagination: PaginationOptions = args && args.pagination ? args.pagination as PaginationOptions : { offset: 0, limit: 1000 };
        const filter: FilterOptions = args && args.filter ? args.filter as FilterOptions : {};
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.readGraph(pagination, filter), null, 2) }] };
      case "search_nodes":
        if (!args?.query) throw new Error("Missing query argument");
        const searchPagination: PaginationOptions = args.pagination ? args.pagination as PaginationOptions : { offset: 0, limit: 20 };
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodes(args.query as string, searchPagination), null, 2) }] };
      case "open_nodes":
        if (!args?.names) throw new Error("Missing names argument");
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.openNodes(args.names as string[]), null, 2) }] };
      case "get_related_nodes":
        if (!args?.startingNodeName) throw new Error("Missing startingNodeName argument");
        const depth = args.depth !== undefined ? args.depth as number : 1;
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getRelatedNodes(args.startingNodeName as string, depth), null, 2) }] };
      case "get_graph_stats":
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getGraphStats(), null, 2) }] };
      case "get_entity_types_summary":
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getEntityTypesSummary(), null, 2) }] };
      case "get_relation_types_summary":
        return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getRelationTypesSummary(), null, 2) }] };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${errorMessage}` }] };
  }
})

// Add initialize request handler
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  try {
    console.error("Initializing memory server with protocol version:", request.params.protocolVersion);
    
    // Give a small delay to ensure transport is ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      serverInfo: {
        name: "agent-memory",
        version: "1.1.0"
      },
      capabilities: {
        tools: {}
      }
    };
  } catch (error) {
    console.error("Error during initialization:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Initialization failed: ${errorMessage}`);
  }
});

// Main function to handle server startup and lifecycle
async function main() {
  try {
    console.error("Init agent-memory server...");
    
    // Initialize transport first
    const transport = new StdioServerTransport();
    
    // Load configuration before connecting
    try {
      console.error("Loading configuration...");
      config.load();
      console.error("Configuration loaded successfully");
    } catch (error) {
      console.error("Failed to load configuration:", error);
      process.exit(1);
    }

    // Initialize knowledge graph manager
    knowledgeGraphManager = new KnowledgeGraphManager();
    const memoryFilePath = config.get('memoryFilePath');
    knowledgeGraphManager.setMemoryFilePath(memoryFilePath);

    // Set up cleanup handlers
    setupCleanupHandlers(server);

    // Connect with retry logic
    let connected = false;
    let retries = 5;
    
    while (!connected && retries > 0) {
      try {
        console.error(`Attempting to connect (${retries} attempts remaining)...`);
        await server.connect(transport);
        connected = true;
        console.error("Successfully connected to transport");
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.error(`Connection failed, retrying in 1 second...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Keep the process running
    process.stdin.resume();
    console.error("Server initialized successfully and ready to accept requests");
    
  } catch (error) {
    console.error("Fatal error during server initialization:", error);
    try {
      await server.close();
    } catch (closeError) {
      console.error("Error during emergency shutdown:", closeError);
    }
    process.exit(1);
  }
}

// Setup cleanup handlers for graceful shutdown
function setupCleanupHandlers(server: Server) {
  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", async () => {
    console.error("\nReceived SIGINT signal, shutting down server gracefully...");
    await gracefulShutdown(server);
  });
  
  // Handle SIGTERM
  process.on("SIGTERM", async () => {
    console.error("Received SIGTERM signal, shutting down server gracefully...");
    await gracefulShutdown(server);
  });
  
  // Handle uncaught exceptions
  process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    await gracefulShutdown(server);
  });
  
  // Handle unhandled promise rejections
  process.on("unhandledRejection", async (reason) => {
    console.error("Unhandled promise rejection:", reason);
    await gracefulShutdown(server);
  });
}

// Function to handle graceful shutdown
async function gracefulShutdown(server: Server) {
  try {
    console.error("Closing server connection...");
    await server.close();
    console.error("Server shutdown completed successfully");
  } catch (error) {
    console.error("Error during server shutdown:", error);
  } finally {
    // Give time for logs to flush before exiting
    setTimeout(() => {
      process.exit(0);
    }, 500);
  }
}

// Start the server
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
