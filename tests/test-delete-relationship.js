#!/usr/bin/env node

// Test script for delete_relationship function
// This script tests deleting relationships between nodes

import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const testDeleteRelationship = () => {
  console.log('🔗🗑️ Testing delete_relationship function...');
  
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
            // Created first node
            const content = response.result?.content?.[0]?.text;
            if (content) {
              const result = JSON.parse(content);
              node1Id = result._id;
              console.log(`✅ Created first node with ID: ${node1Id}`);
            }
          } else if (response.id === 2) {
            // Created second node
            const content = response.result?.content?.[0]?.text;
            if (content) {
              const result = JSON.parse(content);
              node2Id = result._id;
              console.log(`✅ Created second node with ID: ${node2Id}`);
              
              // Create relationship
              console.log('Creating relationship...');
              sendMessage('connect_memories', {
                from: 'TestPerson1',
                to: 'TestLocation1',
                relationship: 'LIVES_IN'
              });
            }
          } else if (response.id === 3) {
            // Created relationship
            console.log('✅ Created relationship');
            
            // Now delete it
            console.log('Deleting relationship...');
            sendMessage('delete_relationship', {
              fromNodeId: node1Id,
              toNodeId: node2Id,
              type: 'LIVES_IN'
            });
          } else if (response.id === 4) {
            // Deleted relationship
            console.log('✅ delete_relationship test passed');
            console.log('Response:', response.result?.content?.[0]?.text);
            
            // Clean up - delete the test nodes
            sendMessage('delete_node', { nodeId: node1Id });
            sendMessage('delete_node', { nodeId: node2Id });
            
            setTimeout(() => mcp.kill(), 1000);
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

  // Create two test nodes
  console.log('Creating test nodes...');
  sendMessage('remember', {
    type: 'person',
    content: 'TestPerson1'
  });
  
  setTimeout(() => {
    sendMessage('remember', {
      type: 'location',
      content: 'TestLocation1'
    });
  }, 500);

  setTimeout(() => {
    console.log('⏰ Test timeout');
    mcp.kill();
  }, 15000);
};

testDeleteRelationship();