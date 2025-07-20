import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Neo4jClient } from './neo4j-client.js';

interface Neo4jServerConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

interface ExecuteQueryArgs {
  query: string;
  params?: Record<string, any>;
}

interface CreateNodeArgs {
  label: string;
  properties: Record<string, any>;
}

interface RememberArgs {
  type: 'person' | 'fact' | 'preference' | 'event' | 'location' | 'topic';
  content: string;
  details?: string;
  relates_to?: string;
}

interface RecallArgs {
  query: string;
  type?: string;
  depth?: number;
}

interface ConnectMemoriesArgs {
  from: string;
  to: string;
  relationship: string;
}

interface CreateRelationshipArgs {
  fromNodeId: number;
  toNodeId: number;
  type: string;
  properties?: Record<string, any>;
}

function isExecuteQueryArgs(args: unknown): args is ExecuteQueryArgs {
  return typeof args === 'object' && args !== null && typeof (args as ExecuteQueryArgs).query === 'string';
}

function isCreateNodeArgs(args: unknown): args is CreateNodeArgs {
  return typeof args === 'object' && args !== null && typeof (args as CreateNodeArgs).label === 'string' && typeof (args as CreateNodeArgs).properties === 'object';
}

function isCreateRelationshipArgs(args: unknown): args is CreateRelationshipArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as CreateRelationshipArgs).fromNodeId === 'number' &&
    typeof (args as CreateRelationshipArgs).toNodeId === 'number' &&
    typeof (args as CreateRelationshipArgs).type === 'string'
  );
}

function isRememberArgs(args: unknown): args is RememberArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as RememberArgs).type === 'string' &&
    typeof (args as RememberArgs).content === 'string' &&
    ['person', 'fact', 'preference', 'event', 'location', 'topic'].includes((args as RememberArgs).type)
  );
}

function isRecallArgs(args: unknown): args is RecallArgs {
  return typeof args === 'object' && args !== null && typeof (args as RecallArgs).query === 'string';
}

function isConnectMemoriesArgs(args: unknown): args is ConnectMemoriesArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as ConnectMemoriesArgs).from === 'string' &&
    typeof (args as ConnectMemoriesArgs).to === 'string' &&
    typeof (args as ConnectMemoriesArgs).relationship === 'string'
  );
}

function parseDetails(details?: string): Record<string, any> {
  const result: Record<string, any> = {};
  if (!details) return result;
  
  const pairs = details.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map(s => s.trim());
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

export class Neo4jServer {
  private server: Server;
  private neo4j: Neo4jClient;

  constructor(config: Neo4jServerConfig) {
    this.server = new Server(
      {
        name: 'mcp-neo4j-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.neo4j = new Neo4jClient(config.uri, config.username, config.password, config.database);
    this.setupToolHandlers();

    // エラーハンドリング
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // ツール一覧の定義
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_query',
          description: 'Execute a Cypher query on Neo4j database',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Cypher query to execute',
              },
              params: {
                type: 'object',
                description: 'Query parameters',
                additionalProperties: true,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'create_node',
          description: 'Create a new node in Neo4j',
          inputSchema: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Node label',
              },
              properties: {
                type: 'object',
                description: 'Node properties',
                additionalProperties: true,
              },
            },
            required: ['label', 'properties'],
          },
        },
        {
          name: 'create_relationship',
          description: 'Create a relationship between two nodes',
          inputSchema: {
            type: 'object',
            properties: {
              fromNodeId: {
                type: 'number',
                description: 'ID of the source node',
              },
              toNodeId: {
                type: 'number',
                description: 'ID of the target node',
              },
              type: {
                type: 'string',
                description: 'Relationship type',
              },
              properties: {
                type: 'object',
                description: 'Relationship properties',
                additionalProperties: true,
              },
            },
            required: ['fromNodeId', 'toNodeId', 'type'],
          },
        },
        {
          name: 'remember',
          description: `Store a memory in the knowledge graph. IMPORTANT: Always use 'recall' first to check if the entity already exists before creating new ones.
          
For people: Names are NOT unique - always gather context (where they work, live, relationships) to distinguish between different people with the same name.
For locations: Clarify ambiguous places (e.g., Cambridge UK vs Cambridge MA).

Usage: remember(type, content, details, relates_to)
- type: "person", "location", "preference", "fact", "event", "topic" 
- content: The main information to remember
- details: Additional context as key=value pairs
- relates_to: Optional - connect to existing memory

Examples:
- remember(type="person", content="Ben", details="relationship=self,location=Cambridge,work=OpenAI")
- remember(type="location", content="Cambridge, UK", details="type=city,country=UK")
- remember(type="preference", content="loves pizza", relates_to="Ben")`,
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['person', 'fact', 'preference', 'event', 'location', 'topic'],
                description: 'Type of memory to store',
              },
              content: {
                type: 'string',
                description: 'Main content to remember',
              },
              details: {
                type: 'string',
                description: 'Additional details as key=value pairs (e.g., "name=Ben,city=Cambridge")',
              },
              relates_to: {
                type: 'string',
                description: 'ID or name of related memory to connect to',
              },
            },
            required: ['type', 'content'],
          },
        },
        {
          name: 'recall',
          description: `Search and retrieve memories from the knowledge graph. Use this BEFORE creating new memories to avoid duplicates.

ALWAYS USE THIS TOOL WHEN:
- User asks about identity: "who am I", "what's my name", "do you know me"
- Starting a conversation (check for relationship=self)
- User mentions any person, place, or topic that might be known
- Before using remember to check if memory already exists

Common queries:
- "What's my name?" → recall(query="relationship=self", type="person")
- "What do you know about me?" → recall(query="[name]", type="person", depth=3)
- "Where do I live?" → recall(query="[name]", type="person", depth=2)
- Check for existing entities → recall(query="Cambridge", type="location")
- Find recent memories → recall(query="", type="person") and check created_at

The depth parameter controls how many relationships to traverse (1=just the node, 2+=includes connections).`,
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'What to search for',
              },
              type: {
                type: 'string',
                description: 'Optional: Filter by memory type',
              },
              depth: {
                type: 'number',
                description: 'How many relationship levels to include (default 1)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'connect_memories',
          description: `Create relationships between existing memories to build a knowledge graph.

Common relationships:
- Person → Location: LIVES_IN, WORKS_IN, VISITED, FROM
- Person → Person: KNOWS, FRIEND_OF, WORKS_WITH, RELATED_TO
- Person → Organization: WORKS_AT, MEMBER_OF, FOUNDED
- Person → Topic: INTERESTED_IN, EXPERT_IN

Example: connect_memories(from="Ben", to="Cambridge, UK", relationship="LIVES_IN")`,
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                description: 'Source memory ID or unique identifier',
              },
              to: {
                type: 'string',
                description: 'Target memory ID or unique identifier',
              },
              relationship: {
                type: 'string',
                description: 'Type of relationship (e.g., KNOWS, LIVES_IN, PREFERS)',
              },
            },
            required: ['from', 'to', 'relationship'],
          },
        },
      ],
    }));

    // ツールの実行ハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'execute_query': {
            if (!isExecuteQueryArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid execute_query arguments');
            }
            const result = await this.neo4j.executeQuery(args.query, args.params ?? {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'create_node': {
            if (!isCreateNodeArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid create_node arguments');
            }
            const result = await this.neo4j.createNode(args.label, args.properties);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'create_relationship': {
            if (!isCreateRelationshipArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid create_relationship arguments');
            }
            const result = await this.neo4j.createRelationship(args.fromNodeId, args.toNodeId, args.type, args.properties);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'remember': {
            if (!isRememberArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid remember arguments');
            }
            
            // Parse additional details
            const properties = parseDetails(args.details);
            properties.content = args.content;
            properties.type = args.type;
            properties.created_at = new Date().toISOString();
            
            // Create the memory node
            const label = args.type.charAt(0).toUpperCase() + args.type.slice(1);
            const result = await this.neo4j.createNode(label, properties);
            
            // If relates_to is specified, create a relationship
            if (args.relates_to) {
              // Find the related node
              const relatedQuery = `
                MATCH (n) 
                WHERE n.content = $content OR id(n) = toInteger($content)
                RETURN id(n) as id
                LIMIT 1
              `;
              const relatedResult = await this.neo4j.executeQuery(relatedQuery, { content: args.relates_to });
              
              if (relatedResult.length > 0) {
                const relatedId = relatedResult[0].id;
                await this.neo4j.createRelationship(
                  result.id,
                  relatedId,
                  'RELATES_TO',
                  { created_at: new Date().toISOString() }
                );
              }
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'recall': {
            if (!isRecallArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid recall arguments');
            }
            
            const depth = args.depth || 1;
            let query = `
              MATCH (n)
              WHERE n.content CONTAINS $query
            `;
            
            if (args.type) {
              query += ` AND labels(n)[0] = $type`;
            }
            
            if (depth > 0) {
              query += `
                OPTIONAL MATCH path = (n)-[*1..${depth}]-(related)
                RETURN n, collect(DISTINCT {
                  node: related,
                  relationship: relationships(path)[0],
                  distance: length(path)
                }) as connections
              `;
            } else {
              query += ` RETURN n, [] as connections`;
            }
            
            const params: Record<string, any> = { query: args.query };
            if (args.type) {
              params.type = args.type.charAt(0).toUpperCase() + args.type.slice(1);
            }
            
            const result = await this.neo4j.executeQuery(query, params);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'connect_memories': {
            if (!isConnectMemoriesArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid connect_memories arguments');
            }
            
            // Find the source node
            const fromQuery = `
              MATCH (n) 
              WHERE n.content = $content OR id(n) = toInteger($content)
              RETURN id(n) as id
              LIMIT 1
            `;
            const fromResult = await this.neo4j.executeQuery(fromQuery, { content: args.from });
            
            if (fromResult.length === 0) {
              throw new Error(`Source memory '${args.from}' not found`);
            }
            
            // Find the target node
            const toResult = await this.neo4j.executeQuery(fromQuery, { content: args.to });
            
            if (toResult.length === 0) {
              throw new Error(`Target memory '${args.to}' not found`);
            }
            
            const result = await this.neo4j.createRelationship(
              fromResult[0].id,
              toResult[0].id,
              args.relationship,
              { created_at: new Date().toISOString() }
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
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    
    // Ensure Neo4j connection is established before accepting MCP connections
    try {
      await this.neo4j.executeQuery('RETURN 1 as test', {});
      console.error('Neo4j connection verified');
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error);
      throw error;
    }
    
    await this.server.connect(transport);
    console.error('Neo4j MCP server running on stdio');
  }

  async close(): Promise<void> {
    await this.neo4j.close();
    await this.server.close();
  }
}
