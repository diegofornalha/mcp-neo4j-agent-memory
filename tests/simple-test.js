#!/usr/bin/env node

// Simple test script with proper environment variables
// Tests all functions in sequence

import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const runTest = () => {
  console.log('🚀 Testing Neo4j MCP Server functions...');
  
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
    console.log(`Sending ${name} test...`);
    mcp.stdin.write(JSON.stringify(message) + '\n');
  };

  mcp.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.result) {
            console.log(`✅ Test ${response.id} passed:`, response.result.content?.[0]?.text?.substring(0, 100) + '...');
          } else if (response.error) {
            console.log(`❌ Test ${response.id} failed:`, response.error.message);
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

  // Send test sequence
  setTimeout(() => {
    console.log('\n1. Testing execute_query...');
    sendMessage('execute_query', {
      query: 'CREATE (n:TestNode {name: "test", created: datetime()}) RETURN n',
      params: {}
    });
  }, 1000);

  setTimeout(() => {
    console.log('\n2. Testing remember...');
    sendMessage('remember', {
      type: 'person',
      content: 'Alice',
      details: 'Software Engineer'
    });
  }, 2000);

  setTimeout(() => {
    console.log('\n3. Testing remember location...');
    sendMessage('remember', {
      type: 'location',
      content: 'San Francisco'
    });
  }, 3000);

  setTimeout(() => {
    console.log('\n4. Testing recall...');
    sendMessage('recall', {
      query: 'Alice',
      type: 'person',
      depth: 1
    });
  }, 4000);

  setTimeout(() => {
    console.log('\n5. Testing connect_memories...');
    sendMessage('connect_memories', {
      from: 'Alice',
      to: 'San Francisco',
      relationship: 'LIVES_IN'
    });
  }, 5000);

  setTimeout(() => {
    console.log('\n⏰ Test completed, terminating...');
    mcp.kill();
  }, 8000);
};

if (!process.env.NEO4J_PASSWORD) {
  console.log('⚠️  IMPORTANT: Please copy .env.example to .env and set your credentials');
  console.log('⚠️  cp .env.example .env && edit .env');
  process.exit(1);
}

runTest();