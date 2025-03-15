# MCP Memory Server

A Model Context Protocol (MCP) server that provides a knowledge graph for storing and retrieving information about entities and their relationships.

## Features

- Create and manage entities with observations
- Create and manage relationships between entities
- Search entities and relationships
- Get related nodes up to a specified depth
- Get graph statistics
- Pagination and filtering support
- Persistent storage using JSONL format

## Installation

```bash
npm install
```

## Configuration

Create a `config.json` file in the root directory:

```json
{
  "memoryFilePath": "memory.jsonl",
  "debug": false
}
```

Or set environment variables:

- `MCP_CONFIG_PATH`: Path to the configuration file
- `DEBUG_CONFIG`: Set to "true" to enable debug mode

## Building

```bash
npm run build
```

## Running

```bash
npm start
```

## Available Tools

### create_entities

Create multiple new entities in the knowledge graph.

```json
{
  "entities": [
    {
      "name": "Entity Name",
      "entityType": "Entity Type",
      "observations": ["Observation 1", "Observation 2"]
    }
  ]
}
```

### create_relations

Create multiple new relations between entities.

```json
{
  "relations": [
    {
      "from": "Source Entity Name",
      "to": "Target Entity Name",
      "relationType": "Relation Type"
    }
  ]
}
```

### search_nodes

Search for nodes in the knowledge graph.

```json
{
  "query": "search text",
  "pagination": {
    "offset": 0,
    "limit": 20
  }
}
```

### get_related_nodes

Get all nodes related to a starting node.

```json
{
  "startingNodeName": "Entity Name",
  "depth": 1
}
```

### get_graph_stats

Get statistics about the knowledge graph.

```json
{}
```

## Development

### Project Structure

- `src/core/`: Core business logic
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions
- `src/index.ts`: Main server entry point

### Testing

```bash
npm test
```

## License

MIT
