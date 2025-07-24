import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Neo4jClient } from '../neo4j-client.js';
import {
  isCreateMemoryArgs,
  isSearchMemoriesArgs,
  isCreateConnectionArgs,
  isUpdateMemoryArgs,
  isUpdateConnectionArgs,
  isDeleteMemoryArgs,
  isDeleteConnectionArgs,
  isListMemoryTypesArgs
} from '../types.js';

export async function handleToolCall(
  name: string,
  args: unknown,
  neo4j: Neo4jClient
): Promise<CallToolResult> {
  try {
    switch (name) {
      case 'search_memories': {
        if (!isSearchMemoriesArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid search_memories arguments');
        }
        
        const depth = args.depth ?? 1;
        const limit = Math.min(args.limit ?? 10, 200);
        
        let orderBy = 'n.created_at DESC';
        if (args.order_by) {
          const orderMatch = args.order_by.match(/^(n\.)?([a-zA-Z_]+)\s+(ASC|DESC)$/i);
          if (orderMatch) {
            const property = orderMatch[2];
            const direction = orderMatch[3].toUpperCase();
            orderBy = `n.${property} ${direction}`;
          }
        }
        
        let query = `
          MATCH (n)
          WHERE n.name CONTAINS $query OR n.context CONTAINS $query OR any(key IN keys(n) WHERE toString(n[key]) CONTAINS $query)
        `;
        
        if (args.type) {
          query += ` AND labels(n)[0] = $type`;
        }
        
        if (depth > 0) {
          query += `
            OPTIONAL MATCH path = (n)-[*1..${depth}]-(related)
            RETURN n, collect(DISTINCT {
              memory: related,
              relationship: relationships(path)[0],
              distance: length(path)
            }) as connections
            ORDER BY ${orderBy}
            LIMIT ${limit}
          `;
        } else {
          query += ` RETURN n, [] as connections
            ORDER BY ${orderBy}
            LIMIT ${limit}`;
        }
        
        const params: Record<string, any> = { query: args.query };
        if (args.type) {
          params.type = args.type;
        }
        
        const result = await neo4j.executeQuery(query, params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_memory': {
        if (!isCreateMemoryArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid create_memory arguments');
        }
        
        // Add created_at timestamp if not provided
        const properties = {
          ...args.properties,
          created_at: args.properties.created_at || new Date().toISOString()
        };
        
        const result = await neo4j.createNode(args.label, properties);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_connection': {
        if (!isCreateConnectionArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid create_connection arguments');
        }
        
        const result = await neo4j.createRelationship(
          args.fromMemoryId,
          args.toMemoryId,
          args.type,
          args.properties || { created_at: new Date().toISOString() }
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_memory': {
        if (!isUpdateMemoryArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid update_memory arguments');
        }
        const result = await neo4j.updateNode(args.nodeId, args.properties);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_connection': {
        if (!isUpdateConnectionArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid update_connection arguments');
        }
        const result = await neo4j.updateRelationship(args.fromMemoryId, args.toMemoryId, args.type, args.properties);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'delete_memory': {
        if (!isDeleteMemoryArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid delete_memory arguments');
        }
        const result = await neo4j.deleteNode(args.nodeId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'delete_connection': {
        if (!isDeleteConnectionArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid delete_connection arguments');
        }
        const result = await neo4j.deleteRelationship(args.fromMemoryId, args.toMemoryId, args.type);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_memory_types': {
        if (!isListMemoryTypesArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid list_memory_types arguments');
        }
        
        const query = `
          MATCH (n)
          WITH labels(n) as nodeLabels
          UNWIND nodeLabels as label
          WITH label, count(*) as count
          ORDER BY count DESC, label
          RETURN collect({type: label, count: count}) as types, sum(count) as totalMemories
        `;
        
        const result = await neo4j.executeQuery(query, {});
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error('Error executing tool:', error);
    return {
      content: [
        {
          type: 'text',
          text: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      ],
      isError: true,
    };
  }
}