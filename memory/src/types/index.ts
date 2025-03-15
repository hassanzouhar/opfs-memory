// Core types for the knowledge graph

export interface BaseRecord {
  uuid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Entity extends BaseRecord {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation extends BaseRecord {
  from: string;
  to: string;
  relationType: string;
}

export interface KnowledgeGraph {
  entries: Entity[];
  relations: Relation[];
}

export interface PaginationOptions {
  offset: number;
  limit: number;
}

export interface FilterOptions {
  entityTypes?: string[];
  relationTypes?: string[];
  fromDate?: string;
  toDate?: string;
  searchText?: string;
}

export interface PaginatedResponse<T> {
  items: T;
  total: number;
  hasMore: boolean;
  nextOffset?: number;
} 