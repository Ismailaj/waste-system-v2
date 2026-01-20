#!/usr/bin/env node

/**
 * Detailed Test of Status Transitions
 */

import fetch from 'node-fetch';

async function testTransitionsDetailed() {
  try {
    // Get admin token
    const loginResponse = await fetch('http://localhost:5050/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cleancity.com', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('Testing status transitions endpoint in detail...\n');

    const response = await fetch('http://localhost:5050/api/analytics/status-transitions?startDate=2026-01-19&endDate=2026-01-20', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Success:', data.success);
    
    if (data.data) {
      console.log('\nDetailed Response:');
      console.log('- Total Reports:', data.data.totalReports);
      console.log('- Valid Reports:', data.data.validReports);
      console.log('- Excluded Reports:', data.data.excludedReports);
      
      if (data.data.transitionAnalytics) {
        console.log('- Transition Analytics:');
        console.log('  - Transition Stats:', data.data.transitionAnalytics.transitionStats?.length || 0);
        console.log('  - Common Paths:', data.data.transitionAnalytics.commonPaths?.length || 0);
        console.log('  - Total Transitions:', data.data.transitionAnalytics.totalTransitions || 0);
        
        if (data.data.transitionAnalytics.commonPaths && data.data.transitionAnalytics.commonPaths.length > 0) {
          console.log('  - Sample Common Path:', data.data.transitionAnalytics.commonPaths[0]);
        }
      }
      
      console.log('\nFull Response (first 2000 chars):');
      console.log(JSON.stringify(data, null, 2).substring(0, 2000) + '...');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testTransitionsDetailed();