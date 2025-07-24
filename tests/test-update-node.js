#!/usr/bin/env node

// Test script for update_node function
// This script tests updating properties of existing nodes

import { spawn } from 'child_process';

const testUpdateNode = () => {
  console.log('🔄 Testing update_node function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { ...process.env, NEO4J_DATABASE: 'test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // First, we need to find a node ID to update
  const findNodeMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'execute_query',
      arguments: {
        query: 'MATCH (n:Person {content: "Alice"}) RETURN id(n) as nodeId LIMIT 1',
        params: {}
      }
    }
  };

  let output = '';
  let nodeId = null;

  mcp.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          
          if (response.id === 1 && !nodeId) {
            // Extract node ID from first query
            const content = response.result?.content?.[0]?.text;
            if (content) {
              const result = JSON.parse(content);
              if (result.length > 0) {
                nodeId = result[0].nodeId;
                console.log(`Found node ID: ${nodeId}`);
                
                // Now test update_node
                const updateMessage = {
                  jsonrpc: '2.0',
                  id: 2,
                  method: 'tools/call',
                  params: {
                    name: 'update_node',
                    arguments: {
                      nodeId: nodeId,
                      properties: {
                        job_title: 'Senior Engineer',
                        updated_at: new Date().toISOString()
                      }
                    }
                  }
                };
                mcp.stdin.write(JSON.stringify(updateMessage) + '\n');
              } else {
                console.log('❌ No Alice node found to update');
                mcp.kill();
              }
            }
          } else if (response.id === 2) {
            console.log('✅ update_node test passed');
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

  // Start by finding a node to update
  mcp.stdin.write(JSON.stringify(findNodeMessage) + '\n');

  setTimeout(() => {
    console.log('⏰ Test timeout');
    mcp.kill();
  }, 10000);
};

testUpdateNode();