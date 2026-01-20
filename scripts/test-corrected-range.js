#!/usr/bin/env node

/**
 * Test Corrected Date Range for Dashboard
 */

import fetch from 'node-fetch';

async function testCorrectedRange() {
  try {
    // Get admin token
    const loginResponse = await fetch('http://localhost:5050/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cleancity.com', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('Testing corrected date ranges for dashboard...\n');

    // Test with corrected dashboard range (ending tomorrow)
    const url = 'http://localhost:5050/api/analytics/trends?startDate=2025-12-21&endDate=2026-01-20&optimize=true&limit=100';
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    console.log('Corrected Dashboard Range (2025-12-21 to 2026-01-20):');
    console.log('  - Status:', response.status);
    console.log('  - Records:', data.dataQuality?.totalRecords || 0);
    console.log('  - Incidents:', data.data?.totalIncidents || 0);
    console.log('  - Categories:', Object.keys(data.data?.categoryTotals || {}).join(', ') || 'none');
    
    if (data.data?.totalIncidents > 0) {
      console.log('  - Sample data:', JSON.stringify(data.data.categoryTotals, null, 4));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCorrectedRange();