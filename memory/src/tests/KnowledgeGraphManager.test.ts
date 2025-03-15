import { promises as fs } from 'fs';
import path from 'path';
import { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';

describe('KnowledgeGraphManager', () => {
  let manager: KnowledgeGraphManager;
  const testMemoryFile = path.join(process.cwd(), 'test-memory.jsonl');

  beforeEach(async () => {
    manager = new KnowledgeGraphManager();
    manager.setMemoryFilePath(testMemoryFile);
    await fs.writeFile(testMemoryFile, '');
  });

  afterEach(async () => {
    try {
      await fs.unlink(testMemoryFile);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('createEntities', () => {
    it('should create new entities', async () => {
      const entities = [
        {
          name: 'John',
          entityType: 'person',
          observations: ['Likes coffee']
        },
        {
          name: 'Anthropic',
          entityType: 'organization',
          observations: ['AI company']
        }
      ];

      const result = await manager.createEntities(entities);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John');
      expect(result[1].name).toBe('Anthropic');
    });

    it('should not create duplicate entities', async () => {
      const entity = {
        name: 'John',
        entityType: 'person',
        observations: ['Likes coffee']
      };

      await manager.createEntities([entity]);
      const result = await manager.createEntities([entity]);
      expect(result).toHaveLength(0);
    });
  });

  describe('createRelations', () => {
    it('should create new relations', async () => {
      await manager.createEntities([
        { name: 'John', entityType: 'person', observations: [] },
        { name: 'Anthropic', entityType: 'organization', observations: [] }
      ]);

      const relations = [
        {
          from: 'John',
          to: 'Anthropic',
          relationType: 'works_at'
        }
      ];

      const result = await manager.createRelations(relations);
      expect(result).toHaveLength(1);
      expect(result[0].from).toBe('John');
      expect(result[0].to).toBe('Anthropic');
    });
  });

  describe('searchNodes', () => {
    it('should find nodes matching the query', async () => {
      await manager.createEntities([
        { name: 'John', entityType: 'person', observations: ['Likes coffee'] },
        { name: 'Jane', entityType: 'person', observations: ['Likes tea'] }
      ]);

      const result = await manager.searchNodes('coffee');
      expect(result.items.entries).toHaveLength(1);
      expect(result.items.entries[0].name).toBe('John');
    });
  });

  describe('getRelatedNodes', () => {
    it('should find related nodes up to specified depth', async () => {
      await manager.createEntities([
        { name: 'John', entityType: 'person', observations: [] },
        { name: 'Anthropic', entityType: 'organization', observations: [] },
        { name: 'OpenAI', entityType: 'organization', observations: [] }
      ]);

      await manager.createRelations([
        { from: 'John', to: 'Anthropic', relationType: 'works_at' },
        { from: 'Anthropic', to: 'OpenAI', relationType: 'competes_with' }
      ]);

      const result = await manager.getRelatedNodes('John', 2);
      expect(result.entries).toHaveLength(3);
      expect(result.relations).toHaveLength(2);
    });
  });

  describe('getGraphStats', () => {
    it('should return correct statistics', async () => {
      await manager.createEntities([
        { name: 'John', entityType: 'person', observations: ['Likes coffee', 'Works remotely'] },
        { name: 'Anthropic', entityType: 'organization', observations: ['AI company'] }
      ]);

      await manager.createRelations([
        { from: 'John', to: 'Anthropic', relationType: 'works_at' }
      ]);

      const stats = await manager.getGraphStats();
      expect(stats.entityCount).toBe(2);
      expect(stats.relationCount).toBe(1);
      expect(stats.observationCount).toBe(3);
    });
  });
}); 