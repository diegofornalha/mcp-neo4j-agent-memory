#!/usr/bin/env node
import { Neo4jServer } from './server.js';

// 環境変数から設定を読み込む
const neo4jPassword = process.env.NEO4J_PASSWORD;

// パスワードが設定されていない場合はエラー
if (!neo4jPassword) {
  console.error('Error: NEO4J_PASSWORD environment variable is required');
  process.exit(1);
}

// All environment variables are required - no defaults
if (!process.env.NEO4J_URI) {
  console.error('Error: NEO4J_URI environment variable is required');
  process.exit(1);
}

if (!process.env.NEO4J_USERNAME) {
  console.error('Error: NEO4J_USERNAME environment variable is required');
  process.exit(1);
}

const config = {
  uri: process.env.NEO4J_URI,
  username: process.env.NEO4J_USERNAME,
  password: neo4jPassword,
  database: process.env.NEO4J_DATABASE, // Optional for Neo4j Community Edition
};

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
