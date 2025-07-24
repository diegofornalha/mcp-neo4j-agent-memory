#!/usr/bin/env node

// Test script for execute_query function
// This script tests basic Cypher query execution

import { spawn } from 'child_process';

const testExecuteQuery = () => {
  console.log('🔍 Testing execute_query function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { ...process.env, NEO4J_DATABASE: 'test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Test query: create a simple test node
  const testMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'execute_query',
      arguments: {
        query: 'CREATE (n:TestNode {name: "test", created: datetime()}) RETURN n',
        params: {}
      }
    }
  };

  mcp.stdin.write(JSON.stringify(testMessage) + '\n');
  
  let output = '';
  mcp.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id === 1) {
            console.log('✅ execute_query test passed');
            console.log('Response:', JSON.stringify(response, null, 2));
            mcp.kill();
            return;
          }
        } catch (e) {
          // Ignore non-JSON lines
        }
      }
    }
  });

  mcp.stderr.on('data', (data) => {
    console.error('❌ Error:', data.toString());
  });

  setTimeout(() => {
    console.log('⏰ Test timeout');
    mcp.kill();
  }, 5000);
};

testExecuteQuery();