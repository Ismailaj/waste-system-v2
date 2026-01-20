#!/usr/bin/env node

/**
 * Test Trends Endpoint with Different Date Ranges
 */

import fetch from 'node-fetch';

async function testTrends() {
  try {
    // Get admin token
    const loginResponse = await fetch('http://localhost:5050/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cleancity.com', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    // Test different date ranges
    const tests = [
      { name: 'Today only', start: '2026-01-19', end: '2026-01-19' },
      { name: 'Today + 1', start: '2026-01-19', end: '2026-01-20' },
      { name: 'Wide range', start: '2025-01-01', end: '2026-12-31' },
      { name: 'Dashboard range', start: '2025-12-20', end: '2026-01-19' }
    ];

    console.log('Testing trends endpoint with different date ranges...\n');

    for (const test of tests) {
      const url = `http://localhost:5050/api/analytics/trends?startDate=${test.start}&endDate=${test.end}&optimize=true&limit=100`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      console.log(`${test.name} (${test.start} to ${test.end}):`);
      console.log(`  - Status: ${response.status}`);
      console.log(`  - Records: ${data.dataQuality?.totalRecords || 0}`);
      console.log(`  - Incidents: ${data.data?.totalIncidents || 0}`);
      console.log(`  - Categories: ${Object.keys(data.data?.categoryTotals || {}).join(', ') || 'none'}`);
      
      if (data.data?.totalIncidents > 0) {
        console.log(`  - Sample data:`, JSON.stringify(data.data.categoryTotals, null, 4));
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testTrends();