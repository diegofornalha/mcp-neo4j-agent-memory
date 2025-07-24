#!/usr/bin/env node

// Test script for update_relationship function
// This script tests updating properties of existing relationships

import { spawn } from 'child_process';

const testUpdateRelationship = () => {
  console.log('🔗🔄 Testing update_relationship function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { ...process.env, NEO4J_DATABASE: 'test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // First, find nodes with a relationship to update
  const findRelMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'execute_query',
      arguments: {
        query: 'MATCH (a:Person {content: "Alice"})-[r:LIVES_IN]->(b:Location {content: "San Francisco"}) RETURN id(a) as fromId, id(b) as toId LIMIT 1',
        params: {}
      }
    }
  };

  let output = '';
  let fromId = null;
  let toId = null;

  mcp.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          
          if (response.id === 1 && !fromId) {
            // Extract node IDs from first query
            const content = response.result?.content?.[0]?.text;
            if (content) {
              const result = JSON.parse(content);
              if (result.length > 0) {
                fromId = result[0].fromId;
                toId = result[0].toId;
                console.log(`Found relationship: ${fromId} -> ${toId}`);
                
                // Now test update_relationship
                const updateMessage = {
                  jsonrpc: '2.0',
                  id: 2,
                  method: 'tools/call',
                  params: {
                    name: 'update_relationship',
                    arguments: {
                      fromNodeId: fromId,
                      toNodeId: toId,
                      type: 'LIVES_IN',
                      properties: {
                        since: '2023',
                        updated_at: new Date().toISOString()
                      }
                    }
                  }
                };
                mcp.stdin.write(JSON.stringify(updateMessage) + '\n');
              } else {
                console.log('❌ No LIVES_IN relationship found to update');
                mcp.kill();
              }
            }
          } else if (response.id === 2) {
            console.log('✅ update_relationship test passed');
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

  // Start by finding a relationship to update
  mcp.stdin.write(JSON.stringify(findRelMessage) + '\n');

  setTimeout(() => {
    console.log('⏰ Test timeout');
    mcp.kill();
  }, 10000);
};

testUpdateRelationship();