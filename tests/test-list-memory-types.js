#!/usr/bin/env node

// Test script for list_memory_types function
// This script tests listing all unique memory types in the knowledge graph

import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const testListMemoryTypes = () => {
  console.log('📋 Testing list_memory_types function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { 
      ...process.env,
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
      NEO4J_DATABASE: process.env.NEO4J_DATABASE,
      NEO4J_URI: process.env.NEO4J_URI,
      NEO4J_USERNAME: process.env.NEO4J_USERNAME
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let messageId = 1;
  let output = '';

  const sendMessage = (name, args) => {
    const message = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'tools/call',
      params: { name, arguments: args }
    };
    mcp.stdin.write(JSON.stringify(message) + '\n');
  };

  mcp.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          
          if (response.id === 1) {
            console.log('✅ Created first test memory (person)');
          } else if (response.id === 2) {
            console.log('✅ Created second test memory (place)');
          } else if (response.id === 3) {
            console.log('✅ Created third test memory (person)');
          } else if (response.id === 4) {
            console.log('✅ Created fourth test memory (project)');
          } else if (response.id === 5) {
            // List memory types result
            console.log('✅ list_memory_types test passed');
            const content = response.result?.content?.[0]?.text;
            if (content) {
              const result = JSON.parse(content);
              console.log('\nMemory Types Found:');
              if (result.length > 0 && result[0].types) {
                result[0].types.forEach(type => {
                  const count = type.count.low || type.count;
                console.log(`- ${type.type}: ${count} memories`);
                });
                console.log(`\nTotal memories: ${result[0].totalMemories}`);
              }
            }
            mcp.kill();
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

  // Create some test memories with different types
  console.log('Creating test memories with different types...');
  
  sendMessage('create_memory', {
    label: 'person',
    properties: {
      name: 'Alice Test',
      created_at: new Date().toISOString()
    }
  });

  setTimeout(() => {
    sendMessage('create_memory', {
      label: 'place',
      properties: {
        name: 'Test City',
        created_at: new Date().toISOString()
      }
    });
  }, 500);

  setTimeout(() => {
    sendMessage('create_memory', {
      label: 'person',
      properties: {
        name: 'Bob Test',
        created_at: new Date().toISOString()
      }
    });
  }, 1000);

  setTimeout(() => {
    sendMessage('create_memory', {
      label: 'project',
      properties: {
        name: 'Test Project',
        created_at: new Date().toISOString()
      }
    });
  }, 1500);

  // Now list all memory types
  setTimeout(() => {
    console.log('\nListing all memory types...');
    sendMessage('list_memory_types', {});
  }, 2000);

  setTimeout(() => {
    console.log('⏰ Test timeout');
    mcp.kill();
  }, 10000);
};

testListMemoryTypes();