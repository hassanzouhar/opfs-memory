# MCP Memory Service

A Model Context Protocol (MCP) service that provides a knowledge graph-based memory system for AI models. This service allows models to store, retrieve, and manage information about entities and their relationships.

## Features

- **Entity Management**: Create, read, and delete entities with associated observations
- **Relationship Management**: Create and manage relationships between entities
- **Advanced Querying**: Search nodes and traverse relationships in the knowledge graph
- **Pagination & Filtering**: Support for paginated results and filtered queries
- **MCP Protocol**: Full implementation of the Model Context Protocol

## Installation

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher

### Local Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd memory
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Configure the service:
Create a `config.json` file in the project root (optional, will use defaults if not provided):
```json
{
  "memoryFilePath": "./memory.jsonl",
  "debug": false
}
```

### Docker Setup

Build and run using Docker:

```bash
docker build -t mcp/memory .
docker run -v $(pwd)/memory.jsonl:/app/memory.jsonl mcp/memory
```

## Usage

The service implements the Model Context Protocol and provides the following tools:

### 1. Create Entities
```typescript
{
  name: "create_entities",
  entities: [
    {
      name: "entity1",
      entityType: "person",
      observations: ["Observation 1", "Observation 2"]
    }
  ]
}
```

### 2. Create Relations
```typescript
{
  name: "create_relations",
  relations: [
    {
      from: "entity1",
      to: "entity2",
      relationType: "knows"
    }
  ]
}
```

### 3. Search Nodes
```typescript
{
  name: "search_nodes",
  query: "search term",
  pagination: {
    offset: 0,
    limit: 20
  }
}
```

### 4. Get Related Nodes
```typescript
{
  name: "get_related_nodes",
  startingNodeName: "entity1",
  depth: 2
}
```

### 5. Get Graph Stats
```typescript
{
  name: "get_graph_stats"
}
```

## Development

### Project Structure

```
memory/
├── src/
│   ├── core/           # Core business logic
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── index.ts        # Main entry point
├── docs/              # Documentation
├── tests/            # Test files
└── config.json       # Configuration file
```

### Available Scripts

- `npm run build`: Build the project
- `npm run start`: Start the service
- `npm run test`: Run tests
- `npm run lint`: Run linting

## Configuration

The service can be configured using environment variables or a `config.json` file:

- `MCP_CONFIG_PATH`: Path to the configuration file
- `DEBUG_CONFIG`: Enable debug mode

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 