#!/usr/bin/env node

// Debug script for remember function validation issue

import { spawn } from 'child_process';

const debugRemember = () => {
  console.log('🐛 Debugging remember function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { ...process.env, NEO4J_DATABASE: 'test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const testMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'remember',
      arguments: {
        type: 'person',
        content: 'Alice'
      }
    }
  };

  console.log('Sending message:', JSON.stringify(testMessage, null, 2));
  
  let output = '';
  mcp.stdout.on('data', (data) => {
    output += data.toString();
    console.log('STDOUT:', data.toString());
  });

  mcp.stderr.on('data', (data) => {
    console.log('STDERR:', data.toString());
  });

  mcp.on('close', (code) => {
    console.log('Process exited with code:', code);
  });

  mcp.stdin.write(JSON.stringify(testMessage) + '\n');
  
  setTimeout(() => {
    console.log('Killing process after timeout');
    mcp.kill();
  }, 5000);
};

debugRemember();