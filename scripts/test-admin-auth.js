#!/usr/bin/env node

/**
 * Test Admin Authentication Flow
 * Tests the complete admin login and analytics access flow
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5050';

async function testAdminAuth() {
  console.log('[TEST] Testing Admin Authentication Flow...\n');

  try {
    // Step 1: Test admin login
    console.log('[STEP 1] Testing admin login...');
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

    console.log('[SUCCESS] Admin login successful');
    console.log('  - User:', loginData.user.name, `(${loginData.user.role})`);
    console.log('  - Token received:', loginData.token ? 'Yes' : 'No');

    const adminToken = loginData.token;

    // Step 2: Test analytics health endpoint
    console.log('\n[STEP 2] Testing analytics health endpoint...');
    const healthResponse = await fetch(`${API_BASE}/api/analytics/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const healthData = await healthResponse.json();
    
    if (!healthResponse.ok) {
      console.error('[ERROR] Analytics health check failed:', healthData);
      return;
    }

    console.log('[SUCCESS] Analytics health check passed');
    console.log('  - Database:', healthData.data.database);
    console.log('  - Cache:', healthData.data.cache);
    console.log('  - System Health:', healthData.data.systemHealth);

    // Step 3: Test analytics trends endpoint
    console.log('\n[STEP 3] Testing analytics trends endpoint...');
    const trendsResponse = await fetch(`${API_BASE}/api/analytics/trends?startDate=2025-01-01&endDate=2025-01-20&optimize=true&limit=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const trendsData = await trendsResponse.json();
    
    if (!trendsResponse.ok) {
      console.error('[ERROR] Analytics trends failed:', trendsData);
      return;
    }

    console.log('[SUCCESS] Analytics trends endpoint working');
    console.log('  - Records found:', trendsData.data?.totalRecords || 0);
    console.log('  - Categories:', Object.keys(trendsData.data?.categoryData || {}));

    console.log('\n[RESULT] ✅ All authentication tests passed!');
    console.log('\n[INSTRUCTIONS] To test in browser:');
    console.log('1. Go to: http://localhost:5050/pages/login.html');
    console.log('2. Login with: admin@cleancity.com / admin123');
    console.log('3. Go to: http://localhost:5050/pages/admin-analytics.html');
    console.log('4. Dashboard should load without authentication errors');

  } catch (error) {
    console.error('[ERROR] Test failed:', error.message);
  }
}

// Run the test
testAdminAuth();