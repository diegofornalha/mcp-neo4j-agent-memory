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
    await this.server.connect(transport);
    console.error('Neo4j MCP server running on stdio');
  }

  async close(): Promise<void> {
    await this.neo4j.close();
    await this.server.close();
  }
}
