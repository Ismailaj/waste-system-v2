#!/usr/bin/env node

/**
 * Analyze Seeded Data for Analytics Issues
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeData() {
  try {
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/cleancity');
    console.log('=== DATA ANALYSIS ===\n');
    
    const Report = mongoose.model('Report', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // Check reports with status history
    const reportsWithHistory = await Report.find({ 'statusHistory.1': { $exists: true } });
    console.log(`Reports with status history: ${reportsWithHistory.length}/15`);
    
    if (reportsWithHistory.length > 0) {
      console.log('Sample status history:', reportsWithHistory[0].statusHistory);
    }
    
    // Check drivers
    const drivers = await User.find({ role: 'driver' });
    console.log(`\nTotal drivers: ${drivers.length}`);
    drivers.forEach(driver => {
      console.log(`  - ${driver.fullname} (${driver.email})`);
    });
    
    // Check assigned reports
    const assignedReports = await Report.find({ assignedDriver: { $exists: true, $ne: null } });
    console.log(`\nReports with assigned drivers: ${assignedReports.length}/15`);
    
    if (assignedReports.length > 0) {
      console.log('Sample assigned report:', {
        id: assignedReports[0]._id,
        status: assignedReports[0].status,
        assignedDriver: assignedReports[0].assignedDriver
      });
    }
    
    // Check report statuses
    const statusCounts = await Report.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('\nStatus distribution:');
    statusCounts.forEach(status => {
      console.log(`  - ${status._id}: ${status.count}`);
    });
    
    // Check report ages (for resolution time calculation)
    const now = new Date();
    const reports = await Report.find({}).limit(3);
    console.log('\nSample report ages:');
    reports.forEach(report => {
      const ageHours = (now - report.createdAt) / (1000 * 60 * 60);
      console.log(`  - ${report._id}: ${ageHours.toFixed(2)}h old, Status: ${report.status}`);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.disconnect();
  }
}

analyzeData();