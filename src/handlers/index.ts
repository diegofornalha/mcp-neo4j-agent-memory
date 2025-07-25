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
  isListMemoryLabelsArgs
} from '../types.js';
import { isGetGuidanceArgs, getGuidanceContent } from '../tools/guidance-tool.js';

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
        
        let orderBy = 'memory.created_at DESC';
        if (args.order_by) {
          const orderMatch = args.order_by.match(/^(memory\.|n\.)?([a-zA-Z_]+)\s+(ASC|DESC)$/i);
          if (orderMatch) {
            const property = orderMatch[2];
            const direction = orderMatch[3].toUpperCase();
            orderBy = `memory.${property} ${direction}`;
          }
        }
        
        const params: Record<string, any> = { query: args.query };
        if (args.label) {
          params.label = args.label;
        }
        
        // Try a different approach: execute simple queries and handle complexity in JavaScript
        const allMemoryIds = new Set<number>();
        
        try {
          // First, get all memories that match the label filter (if any)
          let baseQuery = `MATCH (memory)`;
          if (args.label) {
            baseQuery += ` WHERE labels(memory)[0] = $label`;
          }
          baseQuery += ` RETURN id(memory) as id, properties(memory) as props`;
          
          const allMemories = await neo4j.executeQuery(baseQuery, { label: args.label });
          
          // Filter in JavaScript
          for (const record of allMemories) {
            const props = record.props;
            let found = false;
            
            // Search through all properties
            for (const [key, value] of Object.entries(props)) {
              if (value === null || value === undefined) continue;
              
              if (Array.isArray(value)) {
                // Handle array properties
                for (const item of value) {
                  if (item && item.toString().toLowerCase().includes(args.query.toLowerCase())) {
                    found = true;
                    break;
                  }
                }
              } else {
                // Handle non-array properties
                if (value.toString().toLowerCase().includes(args.query.toLowerCase())) {
                  found = true;
                }
              }
              
              if (found) {
                allMemoryIds.add(record.id);
                break;
              }
            }
          }
        } catch (error) {
          console.error('Error in search:', error);
          // Fallback to a simpler query if the above fails
          const fallbackQuery = `
            MATCH (memory)
            WHERE memory.name CONTAINS $query
               OR memory.context CONTAINS $query
               OR memory.description CONTAINS $query
            ${args.label ? 'AND labels(memory)[0] = $label' : ''}
            RETURN collect(DISTINCT id(memory)) as memoryIds
          `;
          
          const fallbackResults = await neo4j.executeQuery(fallbackQuery, params);
          if (fallbackResults.length > 0 && fallbackResults[0].memoryIds) {
            fallbackResults[0].memoryIds.forEach((id: number) => allMemoryIds.add(id));
          }
        }
        
        
        if (allMemoryIds.size === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify([], null, 2),
              },
            ],
          };
        }
        
        // Query 3: Fetch the actual memories with connections
        let finalQuery = `
          MATCH (memory)
          WHERE id(memory) IN $memoryIds
        `;
        
        if (depth > 0) {
          finalQuery += `
            OPTIONAL MATCH path = (memory)-[*1..${depth}]-(related)
            RETURN memory, collect(DISTINCT {
              memory: related,
              relationship: relationships(path)[0],
              distance: length(path)
            }) as connections
            ORDER BY ${orderBy}
            LIMIT ${limit}
          `;
        } else {
          finalQuery += ` RETURN memory, [] as connections
            ORDER BY ${orderBy}
            LIMIT ${limit}`;
        }
        
        const result = await neo4j.executeQuery(finalQuery, { memoryIds: Array.from(allMemoryIds) });
        
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

      case 'list_memory_labels': {
        if (!isListMemoryLabelsArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid list_memory_labels arguments');
        }
        
        const query = `
          MATCH (memory)
          WITH labels(memory) as nodeLabels
          UNWIND nodeLabels as label
          WITH label, count(*) as count
          ORDER BY count DESC, label
          RETURN collect({label: label, count: count}) as labels, sum(count) as totalMemories
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

      case 'get_guidance': {
        if (!isGetGuidanceArgs(args)) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid get_guidance arguments');
        }
        
        const content = getGuidanceContent(args.topic);
        
        return {
          content: [
            {
              type: 'text',
              text: content,
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