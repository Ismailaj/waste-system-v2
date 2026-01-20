#!/usr/bin/env node

/**
 * Detailed Test of Trends Endpoint Response Structure
 */

import fetch from 'node-fetch';

async function testTrendsDetailed() {
  try {
    // Get admin token
    const loginResponse = await fetch('http://localhost:5050/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cleancity.com', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('Testing trends endpoint with detailed response analysis...\n');

    const url = `http://localhost:5050/api/analytics/trends?startDate=2026-01-19&endDate=2026-01-20&optimize=true&limit=100`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Structure:');
    console.log('  - success:', data.success);
    console.log('  - data keys:', Object.keys(data.data || {}));
    console.log('  - dataQuality keys:', Object.keys(data.dataQuality || {}));
    
    if (data.data) {
      console.log('\nData Content:');
      console.log('  - totalDays:', data.data.totalDays);
      console.log('  - totalIncidents:', data.data.totalIncidents);
      console.log('  - dailyTrends length:', data.data.dailyTrends?.length || 0);
      console.log('  - categoryTotals:', data.data.categoryTotals);
      
      if (data.data.dailyTrends && data.data.dailyTrends.length > 0) {
        console.log('  - Sample daily trend:', JSON.stringify(data.data.dailyTrends[0], null, 4));
      }
    }
    
    console.log('\nDataQuality:');
    console.log('  - totalRecords:', data.dataQuality?.totalRecords || 0);
    console.log('  - validRecords:', data.dataQuality?.validRecords || 0);
    
    console.log('\nFull Response (first 1000 chars):');
    console.log(JSON.stringify(data, null, 2).substring(0, 1000) + '...');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testTrendsDetailed();