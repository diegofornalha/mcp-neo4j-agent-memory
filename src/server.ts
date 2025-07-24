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

interface UpdateNodeArgs {
  nodeId: number;
  properties: Record<string, any>;
}

interface UpdateRelationshipArgs {
  fromNodeId: number;
  toNodeId: number;
  type: string;
  properties: Record<string, any>;
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

function isUpdateNodeArgs(args: unknown): args is UpdateNodeArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as UpdateNodeArgs).nodeId === 'number' &&
    typeof (args as UpdateNodeArgs).properties === 'object'
  );
}

function isUpdateRelationshipArgs(args: unknown): args is UpdateRelationshipArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as UpdateRelationshipArgs).fromNodeId === 'number' &&
    typeof (args as UpdateRelationshipArgs).toNodeId === 'number' &&
    typeof (args as UpdateRelationshipArgs).type === 'string' &&
    typeof (args as UpdateRelationshipArgs).properties === 'object'
  );
}

// parseDetails function removed - was causing entity properties to be stored as node properties
// instead of creating separate entities with relationships

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
          description: `Store individual entities in long-term memory. Create separate nodes for each person, place, or thing.

WHEN TO STORE MEMORIES (like a person would):
- Someone introduces themselves: "My name is Sarah"
- Someone shares personal details: job, age, location, family, pets, hobbies
- Someone mentions preferences: "I love jazz music", "I hate spinach"
- Someone tells you about important life events or experiences
- Someone corrects you about something personal
- Important details that would help in future conversations
- Use your judgment - don't store every casual remark

DON'T STORE:
- Greetings, partial words, "yes/no" answers, casual responses
- Temporary conversation state or casual remarks
- Information already mentioned in current conversation context

ENTITY-BASED APPROACH:
- Store ONE entity per remember() call - don't combine multiple entities
- Use separate remember() calls for each person, place, organization mentioned
- Use connect_memories() to create relationships between entities
- Focus on clean, specific entities that can be connected later

CRITICAL: ENTITY EXTRACTION FOR MEMORY
When someone mentions people, places, or things, extract them as SEPARATE entities with relationships:

BAD APPROACH (storing as properties):
- remember with details="daughter=Nineveh,age=10,son=Isaac,age=17"

GOOD APPROACH (separate entities with relationships):
1. Create person: remember for "Ben" (main person)
2. Create person: remember for "Nineveh" as separate person
3. Create person: remember for "Isaac" as separate person  
4. Create relationships: connect_memories between Ben and each child

ENTITY TYPES TO EXTRACT:
- Person: Names of people mentioned (family, friends, colleagues)
- Location: Cities, venues, addresses, places
- Organization: Companies, schools, groups
- Fact: Ages, dates, important information
- Preference: Likes, dislikes, interests
- Event: Significant moments
- Topic: Areas of knowledge

WHEN TO UPDATE VS CREATE:
- UPDATE: When adding new info about existing entities (age change, new job, moved house)
- CREATE: When introducing completely new entities or correcting major errors
- ALWAYS use recall first to check if entity exists before creating new ones

UPDATE EXAMPLES:
- "Ben moved to London" → update_node on Ben's location property
- "Sarah got promoted" → update_node on Sarah's job_title
- "Ben and Sarah got married" → connect_memories with MARRIED_TO relationship

MEMORY TYPES:
- person: Individual people
- location: Specific places
- fact: Objective information
- preference: Likes/dislikes
- event: Significant moments
- topic: Areas of knowledge

GOOD PATTERN:
1. remember(type="person", content="Ben")
2. remember(type="person", content="Sarah") 
3. connect_memories(from="Ben", to="Sarah", relationship="MARRIED_TO")

BAD PATTERN:
- remember(type="person", content="Ben", details="wife=Sarah,age=42,job=engineer")

Examples:
- remember(type="person", content="Ben")
- remember(type="location", content="Cambridge")  
- remember(type="preference", content="loves cycling")
- Then use connect_memories() to link them`,
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
                description: 'Optional notes field for additional context (avoid using for entities - create separate nodes instead)',
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
- Starting a conversation (check for relationship=self to find who the user is)
- User mentions any person, place, or topic that might be known
- Before using remember to check if memory already exists

Common queries:
- "What's my name?" → recall(query="relationship=self", type="person")
- "What do you know about me?" → recall(query="[name]", type="person", depth=3)
- "Where do I live?" → recall(query="[name]", type="person", depth=2)
- Check for existing entities → recall(query="Cambridge", type="location")
- Find recent memories → recall(query="", type="person") and check created_at

HANDLING EMPTY RESULTS:
- If recall returns [] (empty array), this means NO MEMORIES EXIST YET for this query
- This is NORMAL for new conversations or new topics
- Do NOT interpret empty results as "new conversation" - just means no stored memories
- Continue normally with the conversation using information from current context
- Only store memories when users share meaningful personal information

HANDLING AMBIGUOUS SEARCHES:
- Multiple Johns? → recall(query="John", type="person") then check details to identify which one
- Multiple Cambridges? → recall(query="Cambridge", type="location") then look for country/region
- If multiple results, ask user to clarify: "I know 3 Johns. Do you mean John from Google, John your brother, or John from tennis club?"

WHEN TO RECALL MEMORIES (like a person would):
- They ask what you remember about someone/something
- Something reminds you of previous conversations
- When it would naturally help the conversation

PROACTIVE MEMORY RECALL:
When people, places, or familiar topics are mentioned, you MAY check if you have memories about them:
- Use recall sparingly - only when it would genuinely help the conversation
- Focus on responding to what they're saying NOW rather than always checking memory
- If you do recall something relevant, use it naturally without announcing "I recall..."
- Empty results don't mean anything is wrong - just means you haven't learned about that yet

UNDERSTANDING WHEN TO USE RECALL:

**CHECK CONVERSATION FIRST**: Before using recall, always check your current conversation!
- If user told you their name 3 messages ago, you already know it - don't recall
- If user mentioned they live in Cambridge earlier in THIS chat, you know it - don't recall
- Only use recall when information is NOT in the current conversation

**USE RECALL FOR**:
- Information from PREVIOUS conversations (past sessions)
- Starting a NEW conversation ("who am I?" at the beginning)
- Verifying if something exists in long-term memory before storing it
- Finding connections and relationships stored from past interactions

REMEMBER: Your conversation history is your short-term memory. Neo4j is your long-term memory.
Don't use a database query for something you were just told!

MEMORY PERSPECTIVE:
- Treat stored memories as YOUR personal knowledge about people and situations
- Say "I remember you told me..." or "From what I know about you..." rather than "your memories show..."
- Use your memory naturally like a person would - recall relevant details when they matter to the conversation
- Don't always announce when you're accessing memory - just know things naturally from past conversations
- The memory system helps you be a better conversational partner by remembering context

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

IMPORTANT: Only use AFTER creating both nodes with remember(). The nodes must exist before connecting them.

RELATIONSHIP PATTERNS:
- Family: FATHER_OF, MOTHER_OF, CHILD_OF, SIBLING_OF, MARRIED_TO
- Work: WORKS_FOR, COLLEAGUE_OF, MANAGER_OF, REPORTS_TO
- Location: LIVES_IN, WORKS_IN, BORN_IN, VISITED
- Social: KNOWS, FRIEND_OF, PARTNER_OF
- Interest: INTERESTED_IN, EXPERT_IN, STUDIES

Common relationships:
- Person → Location: LIVES_IN, WORKS_IN, VISITED, FROM
- Person → Person: KNOWS, FRIEND_OF, WORKS_WITH, RELATED_TO
- Person → Organization: WORKS_AT, MEMBER_OF, FOUNDED
- Person → Topic: INTERESTED_IN, EXPERT_IN
- Person → Preference: HAS_PREFERENCE

Examples:
- connect_memories(from="Ben", to="Cambridge, UK", relationship="LIVES_IN")
- connect_memories(from="Ben", to="pizza", relationship="LOVES")
- connect_memories(from="Ben", to="Sarah", relationship="MARRIED_TO")
- connect_memories(from="Ben", to="Nineveh", relationship="FATHER_OF")
- connect_memories(from="Ben", to="OpenAI", relationship="WORKS_FOR")`,
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
        {
          name: 'update_node',
          description: 'Update properties of an existing node',
          inputSchema: {
            type: 'object',
            properties: {
              nodeId: {
                type: 'number',
                description: 'ID of the node to update',
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
          name: 'update_relationship',
          description: 'Update properties of an existing relationship',
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
                description: 'Properties to update/add',
                additionalProperties: true,
              },
            },
            required: ['fromNodeId', 'toNodeId', 'type', 'properties'],
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
            
            // Create clean properties object - avoid storing arbitrary details as properties
            const properties: Record<string, any> = {
              content: args.content,
              type: args.type,
              created_at: new Date().toISOString()
            };
            
            // Set name property for better graph visualization
            if (args.type === 'person' || args.type === 'location' || args.type === 'topic') {
              properties.name = args.content;
            }
            
            // Only store specific, structured details if needed for core functionality
            if (args.details) {
              // Instead of parsing arbitrary key=value pairs, store as a notes field
              properties.notes = args.details;
            }
            
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

          case 'update_node': {
            if (!isUpdateNodeArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid update_node arguments');
            }
            const result = await this.neo4j.updateNode(args.nodeId, args.properties);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'update_relationship': {
            if (!isUpdateRelationshipArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid update_relationship arguments');
            }
            const result = await this.neo4j.updateRelationship(args.fromNodeId, args.toNodeId, args.type, args.properties);
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
