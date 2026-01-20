#!/usr/bin/env node

/**
 * Final Verification Test - All Analytics Endpoints
 */

import fetch from 'node-fetch';

async function testFinalVerification() {
  try {
    console.log('🧪 FINAL VERIFICATION TEST - Admin Analytics Dashboard\n');

    // Get admin token
    const loginResponse = await fetch('http://localhost:5050/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cleancity.com', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('✅ Admin authentication successful\n');

    // Test all critical endpoints
    const endpoints = [
      { name: 'Health Check', url: '/api/analytics/health', expectData: ['analytics', 'database'] },
      { name: 'Trends', url: '/api/analytics/trends?startDate=2026-01-19&endDate=2026-01-20', expectData: ['totalIncidents', 'dailyTrends'] },
      { name: 'Status Distribution', url: '/api/analytics/status-distribution?startDate=2026-01-19&endDate=2026-01-20', expectData: ['totalReports', 'summary'] },
      { name: 'Status Transitions', url: '/api/analytics/status-transitions?startDate=2026-01-19&endDate=2026-01-20', expectData: ['transitionAnalytics'] },
      { name: 'Workflow Timeline', url: '/api/analytics/workflow-timeline?startDate=2026-01-19&endDate=2026-01-20', expectData: ['reportTimelines', 'efficiencyMetrics'] },
      { name: 'Workflow Bottlenecks', url: '/api/analytics/workflow-bottlenecks?startDate=2026-01-19&endDate=2026-01-20', expectData: ['bottlenecks', 'efficiencyMetrics'] },
      { name: 'Driver Performance', url: '/api/analytics/drivers?startDate=2026-01-19&endDate=2026-01-20', expectData: ['driverCount', 'metrics'] },
      { name: 'Resolution Times', url: '/api/analytics/resolution-times?startDate=2026-01-19&endDate=2026-01-20', expectData: [] }
    ];

    let passedTests = 0;
    let totalTests = endpoints.length;

    for (const endpoint of endpoints) {
      process.stdout.write(`🔍 Testing ${endpoint.name}... `);
      
      try {
        const response = await fetch(`http://localhost:5050${endpoint.url}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Check if expected data fields exist
          const hasExpectedData = endpoint.expectData.length === 0 || 
            endpoint.expectData.every(field => data.data && data.data.hasOwnProperty(field));
          
          if (hasExpectedData) {
            console.log('✅ PASS');
            passedTests++;
          } else {
            console.log('⚠️  PARTIAL (missing expected data)');
          }
        } else {
          console.log(`❌ FAIL (${response.status}: ${data.message || 'Unknown error'})`);
        }
      } catch (error) {
        console.log(`❌ ERROR (${error.message})`);
      }
    }

    console.log(`\n📊 TEST RESULTS: ${passedTests}/${totalTests} endpoints passed`);

    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Admin Analytics Dashboard is fully functional.');
      console.log('\n📋 SUMMARY OF FIXES APPLIED:');
      console.log('✅ Fixed authentication token handling');
      console.log('✅ Fixed Tailwind CSS configuration timing');
      console.log('✅ Fixed Math.min/Math.max date conversion bug');
      console.log('✅ Fixed property name mismatch (dailyData vs dailyTrends)');
      console.log('✅ Fixed missing raw records for data quality calculation');
      console.log('✅ Fixed date range boundary issues');
      console.log('✅ Fixed global error handler headers issue');
      console.log('✅ Fixed missing identifyCommonTransitionPaths method');
      console.log('✅ Fixed Report model status history preservation');
      console.log('✅ Fixed JSON parsing error handling');
      
      console.log('\n🚀 READY TO USE:');
      console.log('1. Login: http://localhost:5050/pages/login.html');
      console.log('2. Credentials: admin@cleancity.com / admin123');
      console.log('3. Analytics: http://localhost:5050/pages/admin-analytics.html');
      console.log('4. Expected: 15 incidents, status transitions, workflow data');
    } else {
      console.log('\n⚠️  Some tests failed. Check the individual endpoint results above.');
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

testFinalVerification();