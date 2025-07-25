import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const guidanceTool: Tool = {
  name: 'get_guidance',
  description: 'Get help on using the memory tools effectively',
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Topic: labels, relationships, best-practices, examples, or leave empty for all',
      },
    },
    required: [],
  },
};

export function getGuidanceContent(topic?: string): string {
  const sections = {
    labels: `## Common Memory Labels

Use these labels when creating memories (always use lowercase):

**People & Living Things**
- person: Individual people
- animal: Pets, wildlife
- plant: Trees, flowers, crops

**Places & Locations**  
- place: General locations
- organization: Companies, institutions
- vehicle: Cars, planes, boats

**Concepts & Activities**
- project: Work or personal projects
- event: Meetings, conferences, celebrations
- topic: Subjects of interest
- activity: Sports, hobbies
- skill: Abilities and expertise

**Objects & Media**
- object: Physical items
- food: Meals, ingredients
- media: Books, movies, music
- document: Files, reports
- tool: Software, hardware

**Abstract Concepts**
- idea: Thoughts, concepts
- goal: Objectives, targets
- task: To-dos, assignments
- habit: Routines, behaviors
- health: Medical, wellness`,

    relationships: `## Common Relationship Types

Use UPPERCASE for relationship types:

**Personal Relationships**
- KNOWS: General acquaintance
- FRIENDS_WITH: Close friendship
- MARRIED_TO: Spouse relationship
- FAMILY_OF: Family connection

**Professional Relationships**
- WORKS_AT: Employment
- WORKS_ON: Project involvement
- COLLABORATES_WITH: Working together
- MANAGES: Leadership role
- REPORTS_TO: Reporting structure
- OWNS: Ownership

**Location Relationships**
- LIVES_IN: Residence
- LOCATED_IN: Physical location
- VISITED: Past visits
- FROM: Origin

**Skill & Knowledge**
- HAS_SKILL: Possesses ability
- TEACHES: Instructing others
- LEARNS_FROM: Student relationship

**Project & Creation**
- LEADS: Project leadership
- PARTICIPATES_IN: Involvement
- CREATED: Authorship
- USES: Utilization`,

    'best-practices': `## Best Practices

**Creating Memories**
- Always use lowercase for labels
- Include a 'name' property for easy identification
- Add 'created_at' is automatic if not provided
- Use search_memories first to avoid duplicates

**Searching**
- Empty query string returns all memories
- Use label parameter to filter by type
- Increase depth to include more relationships
- Default limit is 10, max is 200

**Managing Relationships**
- Use UPPERCASE for relationship types
- Add properties to relationships for context (e.g., since, role)
- Search for memory IDs before creating connections
- Use list_memory_labels to see existing labels

**Data Organization**
- Keep labels simple and consistent
- Reuse existing labels when possible
- Add descriptive properties to memories
- Use relationships instead of complex properties`,

    examples: `## Examples

**Creating a Person**
\`\`\`
create_memory({
  label: "person",
  properties: {
    name: "Alice Johnson",
    occupation: "Software Engineer",
    company: "Tech Corp"
  }
})
\`\`\`

**Creating a Relationship**
\`\`\`
// First, find the IDs
search_memories({ query: "Alice Johnson" })
search_memories({ query: "Tech Corp" })

// Then connect them
create_connection({
  fromMemoryId: 123,
  toMemoryId: 456,
  type: "WORKS_AT",
  properties: {
    role: "Senior Engineer",
    since: "2020-01-15"
  }
})
\`\`\`

**Searching with Depth**
\`\`\`
// Find all people and their connections
search_memories({
  query: "",
  label: "person",
  depth: 2,
  limit: 50
})
\`\`\`

**Updating a Memory**
\`\`\`
update_memory({
  nodeId: 123,
  properties: {
    occupation: "Lead Engineer",
    skills: ["Python", "Neo4j", "MCP"]
  }
})
\`\`\``,
  };

  if (!topic) {
    // Return all sections
    return `# Neo4j Agent Memory Guidance

${sections.labels}

${sections.relationships}

${sections['best-practices']}

${sections.examples}`;
  }

  const content = sections[topic as keyof typeof sections];
  if (content) {
    return content;
  }

  return `Unknown topic: '${topic}'. Available topics: labels, relationships, best-practices, examples, or leave empty for all guidance.`;
}

// Type guard for get_guidance arguments
export interface GetGuidanceArgs {
  topic?: string;
}

export function isGetGuidanceArgs(args: unknown): args is GetGuidanceArgs {
  if (typeof args !== 'object' || args === null) return true; // Allow empty args
  const obj = args as Record<string, unknown>;
  return obj.topic === undefined || typeof obj.topic === 'string';
}