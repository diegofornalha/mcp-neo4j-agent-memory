import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tools: Tool[] = [
  {
    name: 'search_memories',
    description: `Search and retrieve memories from the knowledge graph.

Parameters:
- query: Search text (can be empty string to get all memories)
- type: Optional - filter by memory type (e.g., "person", "project", "place")
- depth: How many relationship levels to include (default: 1)
- order_by: Sort field (default: "created_at DESC")
- limit: Max results (default: 10, max: 200)

Examples:
- Search by name: search_memories({"query": "John"})
- Search by type: search_memories({"query": "", "type": "person"})
- Get all with relationships: search_memories({"query": "", "depth": 2})`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search text to find in any property',
        },
        type: {
          type: 'string',
          description: 'Filter by memory type',
        },
        depth: {
          type: 'number',
          description: 'Relationship depth to include (default: 1)',
        },
        order_by: {
          type: 'string',
          description: 'Sort order (e.g., "created_at DESC")',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_memory',
    description: `Create a new memory in the knowledge graph.

Parameters:
- label: The type/category of memory in lowercase (see common types below)
- properties: Key-value pairs of information to store

Common memory types (use lowercase):
- person, place, organization, project, event, topic
- object, animal, plant, food, activity, media
- skill, document, meeting, task, habit
- health, vehicle, tool, idea, goal

The properties should include:
- name: A descriptive name for the memory (recommended)
- created_at: Will be auto-added if not provided
- Any other relevant attributes

Examples:
- Person: create_memory({"label": "person", "properties": {"name": "John Doe", "age": 30}})
- Project: create_memory({"label": "project", "properties": {"name": "Website Redesign", "status": "active"}})
- Skill: create_memory({"label": "skill", "properties": {"name": "Python Programming", "level": "expert"}})`,
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Memory type/category in lowercase (e.g., person, project, skill)',
        },
        properties: {
          type: 'object',
          description: 'Information to store about this memory',
          additionalProperties: true,
        },
      },
      required: ['label', 'properties'],
    },
  },
  {
    name: 'create_connection',
    description: `Create a connection between two memories.

Parameters:
- fromMemoryId: ID of the source memory (use search_memories to find IDs)
- toMemoryId: ID of the target memory
- type: Relationship type (e.g., "KNOWS", "WORKS_ON", "LIVES_IN")
- properties: Optional metadata about the relationship

Common relationship types:
- People: KNOWS, FRIENDS_WITH, MARRIED_TO, MANAGES, REPORTS_TO
- Work: WORKS_AT, WORKS_ON, COLLABORATES_WITH, OWNS
- Location: LIVES_IN, LOCATED_IN, VISITED, FROM
- Skills: HAS_SKILL, TEACHES, LEARNS_FROM
- Projects: LEADS, PARTICIPATES_IN, CREATED, USES

Example:
create_connection({
  "fromMemoryId": 123,
  "toMemoryId": 456,
  "type": "WORKS_ON",
  "properties": {"role": "Lead Developer", "since": "2023-01-01"}
})`,
    inputSchema: {
      type: 'object',
      properties: {
        fromMemoryId: {
          type: 'number',
          description: 'ID of the source memory',
        },
        toMemoryId: {
          type: 'number',
          description: 'ID of the target memory',
        },
        type: {
          type: 'string',
          description: 'Type of relationship',
        },
        properties: {
          type: 'object',
          description: 'Optional relationship metadata',
          additionalProperties: true,
        },
      },
      required: ['fromMemoryId', 'toMemoryId', 'type'],
    },
  },
  {
    name: 'update_memory',
    description: `Update properties of an existing memory.

Parameters:
- nodeId: The ID of the memory to update (from search_memories)
- properties: Key-value pairs to update or add

Examples:
- Update age: update_memory({"nodeId": 123, "properties": {"age": 31}})
- Add location: update_memory({"nodeId": 123, "properties": {"city": "London"}})
- Update status: update_memory({"nodeId": 456, "properties": {"status": "completed"}})

Note: This updates existing properties and adds new ones. To remove a property, set it to null.`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'number',
          description: 'ID of the memory to update',
        },
        properties: {
          type: 'object',
          description: 'Properties to update/add',
          additionalProperties: true,
        },
      },
      required: ['nodeId', 'properties'],
    },
  },
  {
    name: 'update_connection',
    description: `Update properties of an existing relationship.

Parameters:
- fromMemoryId: ID of the source memory
- toMemoryId: ID of the target memory
- type: The exact relationship type
- properties: Properties to update or add

Use when relationship details change:
- Update role in project
- Change relationship status
- Add end date to relationships
- Update relationship metadata

Example:
update_connection({
  "fromMemoryId": 123,
  "toMemoryId": 456,
  "type": "WORKS_ON",
  "properties": {"role": "Senior Developer", "end_date": "2024-12-31"}
})`,
    inputSchema: {
      type: 'object',
      properties: {
        fromMemoryId: {
          type: 'number',
          description: 'ID of the source memory',
        },
        toMemoryId: {
          type: 'number',
          description: 'ID of the target memory',
        },
        type: {
          type: 'string',
          description: 'Relationship type',
        },
        properties: {
          type: 'object',
          description: 'Properties to update/add',
          additionalProperties: true,
        },
      },
      required: ['fromMemoryId', 'toMemoryId', 'type', 'properties'],
    },
  },
  {
    name: 'delete_memory',
    description: `Delete a memory and all its connections.

Parameters:
- nodeId: ID of the memory to delete

⚠️ Warning: This permanently removes the memory and all its connections.

Use with caution - only when:
- User explicitly requests deletion
- Correcting duplicate entries
- Privacy/data removal requests

Always confirm with user before deleting.`,
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'number',
          description: 'ID of the memory to delete',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'delete_connection',
    description: `Delete a specific connection between two memories.

Parameters:
- fromMemoryId: ID of the source memory
- toMemoryId: ID of the target memory
- type: The exact relationship type to delete

Use when:
- Relationship no longer valid
- Correcting mistaken connections
- Updating relationship types

Example:
delete_connection({
  "fromMemoryId": 123,
  "toMemoryId": 456,
  "type": "WORKS_AT"
})`,
    inputSchema: {
      type: 'object',
      properties: {
        fromMemoryId: {
          type: 'number',
          description: 'ID of the source memory',
        },
        toMemoryId: {
          type: 'number',
          description: 'ID of the target memory',
        },
        type: {
          type: 'string',
          description: 'Exact relationship type to delete (e.g., WORKS_FOR, LIVES_IN)',
        },
      },
      required: ['fromMemoryId', 'toMemoryId', 'type'],
    },
  },
  {
    name: 'list_memory_types',
    description: `List all unique memory types (labels) currently in use.

This tool helps the LLM understand what types of memories already exist in the knowledge graph, promoting consistency and preventing duplicate types.

Returns:
- A list of all unique labels/types
- Count of memories for each type
- Total number of memories

Use this before creating new memories to:
- Check existing types to maintain consistency
- Avoid creating variations (Person vs People vs Human)
- Understand the knowledge graph structure`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];