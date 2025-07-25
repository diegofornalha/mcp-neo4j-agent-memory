#!/usr/bin/env node
import { Neo4jServer } from './server.js';

// Check if we have database configuration
const hasDbConfig = process.env.NEO4J_URI && process.env.NEO4J_USERNAME && process.env.NEO4J_PASSWORD;

// Only validate environment variables if at least one is provided
if ((process.env.NEO4J_URI || process.env.NEO4J_USERNAME || process.env.NEO4J_PASSWORD) && !hasDbConfig) {
  // If any Neo4j env var is set, all required ones must be set
  if (!process.env.NEO4J_PASSWORD) {
    console.error('Error: NEO4J_PASSWORD environment variable is required');
    process.exit(1);
  }
  if (!process.env.NEO4J_URI) {
    console.error('Error: NEO4J_URI environment variable is required');
    process.exit(1);
  }
  if (!process.env.NEO4J_USERNAME) {
    console.error('Error: NEO4J_USERNAME environment variable is required');
    process.exit(1);
  }
}

const config = hasDbConfig ? {
  uri: process.env.NEO4J_URI!,
  username: process.env.NEO4J_USERNAME!,
  password: process.env.NEO4J_PASSWORD!,
  database: process.env.NEO4J_DATABASE, // Optional for Neo4j Community Edition
} : undefined;

// サーバーの起動
const server = new Neo4jServer(config);

server.run().catch((error) => {
  console.error('Failed to start Neo4j MCP server:', error);
  process.exit(1);
});

// 終了時のクリーンアップ
process.on('SIGINT', async () => {
  try {
    await server.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await server.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});
