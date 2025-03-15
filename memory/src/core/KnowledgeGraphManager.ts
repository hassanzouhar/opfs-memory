import { promises as fs } from 'fs';
import crypto from 'crypto';
import {
  BaseRecord,
  Entity,
  Relation,
  KnowledgeGraph,
  PaginationOptions,
  FilterOptions,
  PaginatedResponse
} from '../types/index.js';

export class KnowledgeGraphManager {
  private memoryFilePath: string | null = null;
  
  setMemoryFilePath(filePath: string): void {
    if (!filePath) {
      throw new Error('Memory file path cannot be empty');
    }
    this.memoryFilePath = filePath;
  }
  
  private getMemoryFilePath(): string {
    if (!this.memoryFilePath) {
      throw new Error('Memory file path not set. Configuration may not be loaded.');
    }
    return this.memoryFilePath;
  }

  private generateUUID(): string {
    return crypto.randomUUID();
  }

  private getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
  
  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.getMemoryFilePath(), "utf-8");
      const lines = data.split("\n").filter((line: string) => line.trim() !== "");
      
      return lines.reduce((graph: KnowledgeGraph, line: string) => {
        try {
          const item = JSON.parse(line);
          const timestamp = this.getCurrentTimestamp();
          
          if (item.type === "entity") {
            const entity: Entity = {
              ...item,
              uuid: item.uuid || this.generateUUID(),
              createdAt: item.createdAt || timestamp,
              updatedAt: item.updatedAt || timestamp
            };
            graph.entries.push(entity);
          }
          
          if (item.type === "relation") {
            const relation: Relation = {
              ...item,
              uuid: item.uuid || this.generateUUID(),
              createdAt: item.createdAt || timestamp,
              updatedAt: item.updatedAt || timestamp
            };
            graph.relations.push(relation);
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
      ...graph.relations.map(r => JSON.stringify({ type: "relation", ...r }))
    ];
    await fs.writeFile(this.getMemoryFilePath(), lines.join("\n"));
  }

  async createEntities(entities: Omit<Entity, keyof BaseRecord>[]): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const timestamp = this.getCurrentTimestamp();
    
    const newEntities = entities
      .filter(e => !graph.entries.some(existingEntity => existingEntity.name === e.name))
      .map(entity => ({
        ...entity,
        uuid: this.generateUUID(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));
    
    if (newEntities.length > 0) {
      graph.entries.push(...newEntities);
      await this.saveGraph(graph);
    }
    
    return newEntities;
  }

  async createRelations(relations: Omit<Relation, keyof BaseRecord>[]): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const timestamp = this.getCurrentTimestamp();
    
    const newRelations = relations
      .filter(r => !graph.relations.some(existingRelation => 
        existingRelation.from === r.from && 
        existingRelation.to === r.to && 
        existingRelation.relationType === r.relationType
      ))
      .map(relation => ({
        ...relation,
        uuid: this.generateUUID(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));
    
    if (newRelations.length > 0) {
      graph.relations.push(...newRelations);
      await this.saveGraph(graph);
    }
    
    return newRelations;
  }

  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const timestamp = this.getCurrentTimestamp();
    const results = observations.map(o => {
      const entity = graph.entries.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      
      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
      if (newObservations.length > 0) {
        entity.observations.push(...newObservations);
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
    const timestamp = this.getCurrentTimestamp();
    
    deletions.forEach(d => {
      const entity = graph.entries.find(e => e.name === d.entityName);
      if (entity) {
        const initialLength = entity.observations.length;
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
        
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

  private applyPagination<T>(items: T[], pagination: PaginationOptions): T[] {
    return items.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );
  }

  private applyFilters(
    entities: Entity[],
    relations: Relation[],
    filter: FilterOptions
  ): { filteredEntities: Entity[]; filteredRelations: Relation[] } {
    let filteredEntities = entities;
    let filteredRelations = relations;
    
    if (filter.entityTypes?.length) {
      filteredEntities = filteredEntities.filter(e => filter.entityTypes!.includes(e.entityType));
    }
    
    if (filter.relationTypes?.length) {
      filteredRelations = filteredRelations.filter(r => filter.relationTypes!.includes(r.relationType));
    }
    
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filteredEntities = filteredEntities.filter(e => 
        e.name.toLowerCase().includes(searchLower) || 
        e.entityType.toLowerCase().includes(searchLower) || 
        e.observations.some(o => o.toLowerCase().includes(searchLower))
      );
      
      filteredRelations = filteredRelations.filter(r => 
        r.from.toLowerCase().includes(searchLower) || 
        r.to.toLowerCase().includes(searchLower) || 
        r.relationType.toLowerCase().includes(searchLower)
      );
    }
    
    if (filter.fromDate) {
      const fromDate = new Date(filter.fromDate);
      filteredEntities = filteredEntities.filter(e => new Date(e.updatedAt) >= fromDate);
      filteredRelations = filteredRelations.filter(r => new Date(r.updatedAt) >= fromDate);
    }
    
    if (filter.toDate) {
      const toDate = new Date(filter.toDate);
      filteredEntities = filteredEntities.filter(e => new Date(e.updatedAt) <= toDate);
      filteredRelations = filteredRelations.filter(r => new Date(r.updatedAt) <= toDate);
    }
    
    return { filteredEntities, filteredRelations };
  }

  async readGraph(
    pagination: PaginationOptions = { offset: 0, limit: 1000 },
    filter: FilterOptions = {}
  ): Promise<PaginatedResponse<KnowledgeGraph>> {
    const graph = await this.loadGraph();
    
    const { filteredEntities, filteredRelations } = this.applyFilters(
      graph.entries,
      graph.relations,
      filter
    );
    
    const totalEntities = filteredEntities.length;
    const totalRelations = filteredRelations.length;
    
    const paginatedEntities = this.applyPagination(filteredEntities, pagination);
    const paginatedRelations = this.applyPagination(filteredRelations, pagination);
    
    return {
      items: {
        entries: paginatedEntities,
        relations: paginatedRelations
      },
      total: Math.max(totalEntities, totalRelations),
      hasMore: Math.max(totalEntities, totalRelations) > (pagination.offset + pagination.limit),
      nextOffset: pagination.offset + pagination.limit
    };
  }

  async searchNodes(
    query: string,
    pagination: PaginationOptions = { offset: 0, limit: 20 }
  ): Promise<PaginatedResponse<KnowledgeGraph>> {
    const graph = await this.loadGraph();
    const queryLower = query.toLowerCase();
    
    const matchedEntities = graph.entries.filter(e => 
      e.name.toLowerCase().includes(queryLower) ||
      e.entityType.toLowerCase().includes(queryLower) ||
      e.observations.some(o => o.toLowerCase().includes(queryLower))
    );
    
    const matchedEntityNames = new Set(matchedEntities.map(e => e.name));
    
    const matchedRelations = graph.relations.filter(r => 
      r.from.toLowerCase().includes(queryLower) ||
      r.to.toLowerCase().includes(queryLower) ||
      r.relationType.toLowerCase().includes(queryLower) ||
      (matchedEntityNames.has(r.from) && matchedEntityNames.has(r.to))
    );
    
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
    
    return {
      items: {
        entries: paginatedEntities,
        relations: paginatedRelations
      },
      total: Math.max(totalEntities, totalRelations),
      hasMore: hasMoreEntities || hasMoreRelations,
      nextOffset: (hasMoreEntities || hasMoreRelations) ? pagination.offset + pagination.limit : undefined
    };
  }

  async getRelatedNodes(startingNodeName: string, depth: number = 1): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const relatedEntityNames = new Set<string>([startingNodeName]);
    
    let currentDepth = 0;
    let nodesToProcess = [startingNodeName];
    
    while (currentDepth < depth && nodesToProcess.length > 0) {
      const nextLevelNodes: string[] = [];
      
      for (const nodeName of nodesToProcess) {
        const relatedRelations = graph.relations.filter(r => r.from === nodeName || r.to === nodeName);
        
        for (const relation of relatedRelations) {
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
    
    return {
      entries: graph.entries.filter(e => relatedEntityNames.has(e.name)),
      relations: graph.relations.filter(r => 
        relatedEntityNames.has(r.from) && relatedEntityNames.has(r.to)
      )
    };
  }

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