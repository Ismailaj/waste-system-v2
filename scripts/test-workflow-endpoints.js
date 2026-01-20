#!/usr/bin/env node

/**
 * Test Workflow Analytics Endpoints
 * Tests the workflow timeline and bottlenecks endpoints
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5050';

async function testWorkflowEndpoints() {
  console.log('[TEST] Testing Workflow Analytics Endpoints...\n');

  try {
    // Step 1: Get admin token
    console.log('[STEP 1] Getting admin token...');
    const loginResponse = await fetch(`${API_BASE}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@cleancity.com',
        password: 'admin123'
      })
    });

    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.error('[ERROR] Admin login failed:', loginData);
      return;
    }

    const adminToken = loginData.token;
    console.log('[SUCCESS] Admin token obtained');

    // Step 2: Test workflow timeline endpoint
    console.log('\n[STEP 2] Testing workflow timeline endpoint...');
    const timelineResponse = await fetch(`${API_BASE}/api/analytics/workflow-timeline?startDate=2026-01-19&endDate=2026-01-20&groupBy=day&maxReports=50`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Timeline Response Status:', timelineResponse.status);
    const timelineData = await timelineResponse.json();
    
    if (!timelineResponse.ok) {
      console.error('[ERROR] Workflow timeline failed:', timelineData);
    } else {
      console.log('[SUCCESS] Workflow timeline endpoint working');
      console.log('  - Timeline data:', JSON.stringify(timelineData, null, 2));
    }

    // Step 3: Test workflow bottlenecks endpoint
    console.log('\n[STEP 3] Testing workflow bottlenecks endpoint...');
    const bottlenecksResponse = await fetch(`${API_BASE}/api/analytics/workflow-bottlenecks?startDate=2026-01-19&endDate=2026-01-20`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Bottlenecks Response Status:', bottlenecksResponse.status);
    const bottlenecksData = await bottlenecksResponse.json();
    
    if (!bottlenecksResponse.ok) {
      console.error('[ERROR] Workflow bottlenecks failed:', bottlenecksData);
    } else {
      console.log('[SUCCESS] Workflow bottlenecks endpoint working');
      console.log('  - Bottlenecks data:', JSON.stringify(bottlenecksData, null, 2));
    }

    // Step 4: Test trends endpoint for comparison
    console.log('\n[STEP 4] Testing trends endpoint for comparison...');
    const trendsResponse = await fetch(`${API_BASE}/api/analytics/trends?startDate=2026-01-19&endDate=2026-01-20&optimize=true&limit=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const trendsData = await trendsResponse.json();
    
    if (!trendsResponse.ok) {
      console.error('[ERROR] Trends failed:', trendsData);
    } else {
      console.log('[SUCCESS] Trends endpoint working');
      console.log('  - Total records:', trendsData.data?.totalRecords || 0);
      console.log('  - Categories:', Object.keys(trendsData.data?.categoryData || {}));
    }

  } catch (error) {
    console.error('[ERROR] Test failed:', error.message);
  }
}

// Run the test
testWorkflowEndpoints();