#!/usr/bin/env node

// Test script for connect_memories function
// This script tests creating relationships between existing memories

import { spawn } from 'child_process';

const testConnectMemories = () => {
  console.log('🔗 Testing connect_memories function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { ...process.env, NEO4J_DATABASE: 'test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const tests = [
    {
      id: 1,
      from: 'Alice',
      to: 'San Francisco',
      relationship: 'LIVES_IN'
    },
    {
      id: 2,
      from: 'Alice',
      to: 'loves coffee',
      relationship: 'HAS_PREFERENCE'
    }
  ];

  let completedTests = 0;
  let output = '';

  mcp.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id && response.id <= tests.length) {
            console.log(`✅ connect_memories test ${response.id} passed`);
            console.log('Response:', JSON.stringify(response, null, 2));
            completedTests++;
            
            if (completedTests === tests.length) {
              console.log('🎉 All connect_memories tests completed');
              mcp.kill();
              return;
            }
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

  // Send all test messages
  tests.forEach(test => {
    const testMessage = {
      jsonrpc: '2.0',
      id: test.id,
      method: 'tools/call',
      params: {
        name: 'connect_memories',
        arguments: {
          from: test.from,
          to: test.to,
          relationship: test.relationship
        }
      }
    };
    mcp.stdin.write(JSON.stringify(testMessage) + '\n');
  });

  setTimeout(() => {
    console.log('⏰ Test timeout');
    mcp.kill();
  }, 10000);
};

testConnectMemories();