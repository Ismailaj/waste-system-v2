#!/usr/bin/env node

/**
 * Test Data Aggregation Directly
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Report from '../models/report.js';

dotenv.config();

async function testAggregation() {
  try {
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/cleancity');
    console.log('Connected to MongoDB');

    // First, let's see what reports we have
    const allReports = await Report.find({}).limit(5);
    console.log('\nSample reports:');
    allReports.forEach(r => {
      console.log(`  - ID: ${r._id}, Category: ${r.category}, Status: ${r.status}, Created: ${r.createdAt}`);
    });

    // Test the exact aggregation pipeline used in trends
    const startDate = new Date('2026-01-19T00:00:00.000Z');
    const endDate = new Date('2026-01-20T00:00:00.000Z');
    
    console.log(`\nTesting aggregation with date range: ${startDate} to ${endDate}`);

    const matchStage = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    console.log('Match stage:', JSON.stringify(matchStage, null, 2));

    // Test just the match stage first
    const matchedReports = await Report.find(matchStage);
    console.log(`\nReports matching date range: ${matchedReports.length}`);

    if (matchedReports.length > 0) {
      console.log('Sample matched report:');
      console.log(`  - Created: ${matchedReports[0].createdAt}`);
      console.log(`  - Category: ${matchedReports[0].category}`);
      console.log(`  - Status: ${matchedReports[0].status}`);
    }

    // Now test the full aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            category: "$category"
          },
          count: { $sum: 1 },
          reports: {
            $push: {
              id: "$_id",
              status: "$status",
              createdAt: "$createdAt"
            }
          }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          categories: {
            $push: {
              category: "$_id.category",
              count: "$count",
              reports: "$reports"
            }
          },
          totalCount: { $sum: "$count" }
        }
      },
      { $sort: { "_id": 1 } },
      {
        $project: {
          date: "$_id",
          categories: 1,
          totalCount: 1,
          _id: 0
        }
      }
    ];

    console.log('\nRunning aggregation pipeline...');
    const results = await Report.aggregate(pipeline);
    console.log(`Aggregation results: ${results.length} groups`);
    
    if (results.length > 0) {
      console.log('Sample result:', JSON.stringify(results[0], null, 2));
    }

    await mongoose.disconnect();

  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.disconnect();
  }
}

testAggregation();