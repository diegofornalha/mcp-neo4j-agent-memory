# MCP Neo4j Server

Neo4jデータベースとClaude Desktopを連携させるためのMCPサーバーです。

## 機能

以下のツールを提供します：

- `execute_query`: Neo4jデータベースに対してCypherクエリを実行
- `create_node`: 新しいノードを作成
- `create_relationship`: ノード間のリレーションシップを作成

## セットアップ

1. 必要な環境変数を設定：
   - `NEO4J_URI`: Neo4jデータベースのURI（デフォルト: bolt://localhost:7687）
   - `NEO4J_USERNAME`: Neo4jのユーザー名（デフォルト: neo4j）
   - `NEO4J_PASSWORD`: Neo4jのパスワード（必須）

2. プロジェクトをビルド：
```bash
npm install
npm run build
```

## 使用例

### クエリの実行
```typescript
use_mcp_tool({
  server_name: "neo4j",
  tool_name: "execute_query",
  arguments: {
    query: "MATCH (n) RETURN n LIMIT 10"
  }
});
```

### ノードの作成
```typescript
use_mcp_tool({
  server_name: "neo4j",
  tool_name: "create_node",
  arguments: {
    label: "Person",
    properties: {
      name: "John Doe",
      age: 30
    }
  }
});
```

### リレーションシップの作成
```typescript
use_mcp_tool({
  server_name: "neo4j",
  tool_name: "create_relationship",
  arguments: {
    fromNodeId: 1,
    toNodeId: 2,
    type: "KNOWS",
    properties: {
      since: "2023"
    }
  }
});
```

## ライセンス

MIT
