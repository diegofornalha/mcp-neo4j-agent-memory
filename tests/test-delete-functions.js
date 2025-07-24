#!/usr/bin/env node

// Test script for delete_node and delete_relationship functions

import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const runTest = () => {
  console.log('🗑️ Testing delete functions...');
  
  if (!process.env.NEO4J_PASSWORD) {
    console.log('⚠️  Please set NEO4J_PASSWORD in .env file');
    process.exit(1);
  }

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
  let node1Id = null;
  let node2Id = null;

  const sendMessage = (name, args) => {
    const message = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'tools/call',
      params: { name, arguments: args }
    };
    console.log(`📤 Sending ${name}:`, args);
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
            console.log(`✅ Response ${response.id}:`, response.result.content?.[0]?.text?.substring(0, 200));
            
            // Parse node IDs from creation responses
            if (response.id === 1 || response.id === 2) {
              const content = response.result.content?.[0]?.text;
              if (content) {
                const result = JSON.parse(content);
                if (response.id === 1) {
                  node1Id = result.n._id;
                  console.log(`📝 Node 1 ID: ${node1Id}`);
                } else {
                  node2Id = result.n._id;
                  console.log(`📝 Node 2 ID: ${node2Id}`);
                }
              }
            }
          } else if (response.error) {
            console.log(`❌ Error ${response.id}:`, response.error.message);
          }
        } catch (e) {
          // Ignore non-JSON lines
        }
      }
    }
  });

  mcp.stderr.on('data', (data) => {
    console.error('❌ stderr:', data.toString());
  });

  // Test sequence
  const runTests = async () => {
    // 1. Create two test nodes
    console.log('\n1️⃣ Creating test nodes...');
    sendMessage('remember', {
      type: 'person',
      content: 'DeleteTestPerson'
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    sendMessage('remember', {
      type: 'location',
      content: 'DeleteTestLocation'
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Create a relationship
    console.log('\n2️⃣ Creating relationship...');
    sendMessage('connect_memories', {
      from: 'DeleteTestPerson',
      to: 'DeleteTestLocation',
      relationship: 'LIVES_IN'
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Delete the relationship
    console.log('\n3️⃣ Testing delete_relationship...');
    if (node1Id && node2Id) {
      sendMessage('delete_relationship', {
        fromNodeId: node1Id,
        toNodeId: node2Id,
        type: 'LIVES_IN'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Delete the nodes
    console.log('\n4️⃣ Testing delete_node...');
    if (node1Id) {
      sendMessage('delete_node', {
        nodeId: node1Id
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (node2Id) {
      sendMessage('delete_node', {
        nodeId: node2Id
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n✅ Test completed!');
    mcp.kill();
  };
  
  // Start tests after server is ready
  setTimeout(runTests, 1000);
};

runTest();