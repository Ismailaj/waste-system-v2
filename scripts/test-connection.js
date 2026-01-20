import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Report from "../models/report.js";

dotenv.config();

async function testDatabaseConnection() {
  console.log("[INFO] Testing MongoDB connection...");
  
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URL);
    console.log("[SUCCESS] Connected to MongoDB successfully");
    
    // Test basic queries
    const userCount = await User.countDocuments();
    const reportCount = await Report.countDocuments();
    
    console.log(`[STATS] Database Statistics:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Reports: ${reportCount}`);
    
    // Test user roles
    const roleStats = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);
    
    console.log(`   User Roles:`);
    roleStats.forEach(stat => {
      console.log(`     ${stat._id}: ${stat.count}`);
    });
    
    // Test report statuses
    const statusStats = await Report.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    
    console.log(`   Report Statuses:`);
    statusStats.forEach(stat => {
      console.log(`     ${stat._id}: ${stat.count}`);
    });
    
    // Test geocoded reports
    const geocodedCount = await Report.countDocuments({
      latitude: { $exists: true, $ne: null },
      longitude: { $exists: true, $ne: null }
    });
    
    console.log(`   Geocoded Reports: ${geocodedCount}/${reportCount}`);
    
    console.log("[SUCCESS] Database connection test completed successfully");
    
  } catch (error) {
    console.error("[ERROR] Database connection failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("[INFO] Database connection closed");
  }
}

testDatabaseConnection();
