#!/usr/bin/env node

/**
 * Test Status and Driver Analytics Endpoints
 */

import fetch from 'node-fetch';

async function testStatusEndpoints() {
  try {
    // Get admin token
    const loginResponse = await fetch('http://localhost:5050/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cleancity.com', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('Testing status and driver analytics endpoints...\n');

    // Test endpoints that were showing empty data
    const endpoints = [
      { name: 'Status Distribution', url: '/api/analytics/status-distribution' },
      { name: 'Status Transitions', url: '/api/analytics/status-transitions' },
      { name: 'Driver Performance', url: '/api/analytics/drivers' },
      { name: 'Resolution Times', url: '/api/analytics/resolution-times' }
    ];

    for (const endpoint of endpoints) {
      console.log(`[TEST] ${endpoint.name}...`);
      
      const response = await fetch(`http://localhost:5050${endpoint.url}?startDate=2026-01-19&endDate=2026-01-20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      console.log(`  - Status: ${response.status}`);
      
      if (response.ok) {
        console.log(`  - Success: ${data.success}`);
        console.log(`  - Data keys: ${Object.keys(data.data || {}).join(', ')}`);
        
        // Show specific metrics based on endpoint
        if (endpoint.name === 'Status Distribution' && data.data) {
          console.log(`  - Total Reports: ${data.data.totalReports || 0}`);
          console.log(`  - Completion Rate: ${data.data.summary?.completionRate || 0}%`);
        } else if (endpoint.name === 'Status Transitions' && data.data) {
          console.log(`  - Total Transitions: ${data.data.totalTransitions || 0}`);
          console.log(`  - Common Paths: ${data.data.commonPaths?.length || 0}`);
        } else if (endpoint.name === 'Driver Performance' && data.data) {
          console.log(`  - Active Drivers: ${data.data.activeDrivers || 0}`);
          console.log(`  - Avg Completion Rate: ${data.data.averageCompletionRate || 0}%`);
        } else if (endpoint.name === 'Resolution Times' && data.data) {
          console.log(`  - Avg Resolution Time: ${data.data.averageResolutionTime || 0}h`);
        }
      } else {
        console.log(`  - Error: ${data.error?.message || data.message || 'Unknown error'}`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testStatusEndpoints();