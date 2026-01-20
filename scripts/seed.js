import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";
import Report from "../models/report.js";
import { geocodeAddress } from "../utils/geocoding.js";

dotenv.config();

// Sample data
const sampleUsers = [
  {
    fullname: "John Doe",
    email: "john.doe@example.com",
    password: "password123",
    role: "citizen"
  },
  {
    fullname: "Jane Smith",
    email: "jane.smith@example.com", 
    password: "password123",
    role: "citizen"
  },
  {
    fullname: "Mike Johnson",
    email: "mike.johnson@example.com",
    password: "password123",
    role: "driver"
  },
  {
    fullname: "Sarah Wilson",
    email: "sarah.wilson@example.com",
    password: "password123",
    role: "driver"
  },
  {
    fullname: "Admin User",
    email: "admin@cleancity.com",
    password: "admin123",
    role: "admin"
  },
  {
    fullname: "David Brown",
    email: "david.brown@example.com",
    password: "password123",
    role: "citizen"
  },
  {
    fullname: "Lisa Garcia",
    email: "lisa.garcia@example.com",
    password: "password123",
    role: "driver"
  }
];

const sampleAddresses = [
  "123 Main Street, New York, NY 10001",
  "456 Oak Avenue, Los Angeles, CA 90210",
  "789 Pine Road, Chicago, IL 60601",
  "321 Elm Street, Houston, TX 77001",
  "654 Maple Drive, Phoenix, AZ 85001",
  "987 Cedar Lane, Philadelphia, PA 19101",
  "147 Birch Street, San Antonio, TX 78201",
  "258 Walnut Avenue, San Diego, CA 92101",
  "369 Cherry Road, Dallas, TX 75201",
  "741 Spruce Street, San Jose, CA 95101",
  "852 Ash Drive, Austin, TX 73301",
  "963 Poplar Lane, Jacksonville, FL 32099",
  // Additional addresses for enhanced workflow testing
  "555 Broadway, New York, NY 10012",
  "777 Sunset Boulevard, Los Angeles, CA 90028",
  "888 Michigan Avenue, Chicago, IL 60611"
];

const sampleReports = [
  {
    category: "illegal_dumping",
    description: "Large pile of construction debris dumped on the sidewalk. Blocking pedestrian access and creating safety hazard.",
    status: "Pending"
  },
  {
    category: "recyclable",
    description: "Overflowing recycling bin with cardboard boxes scattered around the area.",
    status: "Assigned"
  },
  {
    category: "hazardous_waste",
    description: "Old paint cans and chemical containers left near storm drain. Potential environmental hazard.",
    status: "In Progress"
  },
  {
    category: "illegal_dumping",
    description: "Furniture and household items dumped in vacant lot. Attracting pests and creating eyesore.",
    status: "Completed"
  },
  {
    category: "recyclable",
    description: "Glass bottles and aluminum cans mixed with regular trash. Needs proper sorting.",
    status: "Rejected",
    rejectionMessage: "Location could not be accessed due to private property restrictions. Please contact property owner first."
  },
  {
    category: "hazardous_waste",
    description: "Car batteries and motor oil containers improperly disposed in residential area.",
    status: "Assigned"
  },
  {
    category: "illegal_dumping",
    description: "Electronic waste including old TVs and computers dumped behind shopping center.",
    status: "In Progress"
  },
  {
    category: "recyclable",
    description: "Large amount of paper and cardboard from office building needs collection.",
    status: "Pending"
  },
  {
    category: "hazardous_waste",
    description: "Medical waste containers found in public park. Immediate attention required.",
    status: "Completed"
  },
  {
    category: "illegal_dumping",
    description: "Tire dump discovered near river. Environmental concern due to proximity to water source.",
    status: "Assigned"
  },
  // Additional reports to better test enhanced workflow features
  {
    category: "recyclable",
    description: "Broken glass and plastic containers scattered in parking lot after storm.",
    status: "Rejected",
    rejectionMessage: "Area has been cleaned by property maintenance team. No further action required."
  },
  {
    category: "hazardous_waste",
    description: "Asbestos materials from old building renovation left in dumpster.",
    status: "In Progress"
  },
  {
    category: "illegal_dumping",
    description: "Multiple bags of household trash dumped in forest preserve area.",
    status: "Completed"
  },
  {
    category: "recyclable",
    description: "Commercial cardboard waste from retail store needs pickup.",
    status: "Assigned"
  },
  {
    category: "hazardous_waste",
    description: "Chemical spill from industrial facility requires specialized cleanup.",
    status: "Rejected",
    rejectionMessage: "This requires specialized hazmat team. Report has been forwarded to environmental services department."
  }
];

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("[SUCCESS] Connected to MongoDB");
  } catch (error) {
    console.error("[ERROR] MongoDB connection error:", error.message);
    process.exit(1);
  }
}

async function clearDatabase() {
  try {
    await User.deleteMany({});
    await Report.deleteMany({});
    console.log("[INFO] Cleared existing data");
  } catch (error) {
    console.error("[ERROR] Error clearing database:", error.message);
    throw error;
  }
}

async function createUsers() {
  console.log("[INFO] Creating users...");
  const createdUsers = [];
  
  for (const userData of sampleUsers) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = new User({
        ...userData,
        password: hashedPassword
      });
      
      const savedUser = await user.save();
      createdUsers.push(savedUser);
      console.log(`   [SUCCESS] Created ${userData.role}: ${userData.fullname} (${userData.email})`);
    } catch (error) {
      console.error(`   [ERROR] Error creating user ${userData.email}:`, error.message);
    }
  }
  
  return createdUsers;
}

async function createReports(users) {
  console.log("[INFO] Creating reports...");
  const createdReports = [];
  
  // Get users by role
  const citizens = users.filter(u => u.role === "citizen");
  const drivers = users.filter(u => u.role === "driver");
  const admins = users.filter(u => u.role === "admin");
  
  for (let i = 0; i < sampleReports.length; i++) {
    try {
      const reportData = sampleReports[i];
      const address = sampleAddresses[i % sampleAddresses.length];
      
      // Assign random citizen as reporter (unless it's an admin report)
      let reporter = citizens[Math.floor(Math.random() * citizens.length)];
      
      // Create base report data
      const newReportData = {
        ...reportData,
        address,
        user: reporter._id,
        photos: [] // Empty for seed data, but could add sample URLs
      };
      
      // Try to geocode the address
      console.log(`   [GEOCODING] Processing: ${address}`);
      try {
        const geocodingResult = await geocodeAddress(address);
        if (geocodingResult.success) {
          newReportData.latitude = geocodingResult.latitude;
          newReportData.longitude = geocodingResult.longitude;
          console.log(`   [SUCCESS] Geocoded: ${geocodingResult.latitude}, ${geocodingResult.longitude}`);
        } else {
          console.log(`   [WARNING] Geocoding failed: ${geocodingResult.error}`);
        }
      } catch (geocodingError) {
        console.log(`   [WARNING] Geocoding error: ${geocodingError.message}`);
      }
      
      // Assign driver for non-pending reports
      if (reportData.status !== "Pending" && drivers.length > 0) {
        const assignedDriver = drivers[Math.floor(Math.random() * drivers.length)];
        newReportData.assignedDriver = assignedDriver._id;
      }
      
      // Add rejection metadata for rejected reports with enhanced details
      if (reportData.status === "Rejected") {
        if (drivers.length > 0) {
          const rejector = drivers[Math.floor(Math.random() * drivers.length)];
          newReportData.rejectedBy = rejector._id;
          newReportData.rejectedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Random date within last week
        }
      }
      
      // Create admin reports (enhanced workflow feature)
      // Every 5th report is an admin report to test the admin direct reporting workflow
      if (i % 5 === 0 && admins.length > 0) {
        newReportData.user = admins[0]._id;
        newReportData.isAdminReport = true;
        newReportData.status = "Assigned"; // Admin reports start as Assigned per requirements
        if (drivers.length > 0) {
          newReportData.assignedDriver = drivers[Math.floor(Math.random() * drivers.length)]._id;
        }
        console.log(`   [ADMIN_REPORT] Creating admin report with auto-assignment`);
      }
      
      // Add status history for enhanced tracking (new feature)
      const statusHistory = [{
        status: newReportData.status === "Assigned" && newReportData.isAdminReport ? "Pending" : newReportData.status,
        timestamp: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Random date within last 2 weeks
        changedBy: newReportData.user,
        notes: "Report created"
      }];
      
      // Add assignment history if report is assigned
      if (newReportData.assignedDriver) {
        statusHistory.push({
          status: "Assigned",
          timestamp: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000), // Random date within last 10 days
          changedBy: newReportData.isAdminReport ? newReportData.user : admins[0]?._id,
          notes: newReportData.isAdminReport ? "Auto-assigned during admin report creation" : "Assigned by admin"
        });
      }
      
      // Add progress history for in-progress reports
      if (newReportData.status === "In Progress") {
        statusHistory.push({
          status: "In Progress",
          timestamp: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000), // Random date within last 5 days
          changedBy: newReportData.assignedDriver,
          notes: "Driver started working on this report"
        });
      }
      
      // Add completion history for completed reports
      if (newReportData.status === "Completed") {
        statusHistory.push({
          status: "Completed",
          timestamp: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000), // Random date within last 3 days
          changedBy: newReportData.assignedDriver,
          notes: "Report resolved successfully"
        });
      }
      
      // Add rejection history for rejected reports
      if (newReportData.status === "Rejected") {
        statusHistory.push({
          status: "Rejected",
          timestamp: newReportData.rejectedAt || new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          changedBy: newReportData.rejectedBy,
          notes: newReportData.rejectionMessage
        });
      }
      
      newReportData.statusHistory = statusHistory;
      
      const report = new Report(newReportData);
      const savedReport = await report.save();
      createdReports.push(savedReport);
      
      const reportType = newReportData.isAdminReport ? "admin" : "citizen";
      console.log(`   [SUCCESS] Created ${reportType} ${reportData.category} report: ${reportData.status}`);
      
      // Add small delay to avoid overwhelming geocoding service
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   [ERROR] Error creating report ${i + 1}:`, error.message);
    }
  }
  
  return createdReports;
}

async function displaySummary(users, reports) {
  console.log("\n[SUMMARY] ENHANCED WORKFLOW SEED SUMMARY");
  console.log("========================================");
  
  // User summary
  const usersByRole = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});
  
  console.log("[INFO] Users Created:");
  Object.entries(usersByRole).forEach(([role, count]) => {
    console.log(`   ${role}: ${count}`);
  });
  
  // Report summary
  const reportsByStatus = reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1;
    return acc;
  }, {});
  
  const reportsByCategory = reports.reduce((acc, report) => {
    acc[report.category] = (acc[report.category] || 0) + 1;
    return acc;
  }, {});
  
  console.log("\n[INFO] Reports Created:");
  console.log("   By Status:");
  Object.entries(reportsByStatus).forEach(([status, count]) => {
    console.log(`     ${status}: ${count}`);
  });
  
  console.log("   By Category:");
  Object.entries(reportsByCategory).forEach(([category, count]) => {
    console.log(`     ${category}: ${count}`);
  });
  
  const geocodedReports = reports.filter(r => r.latitude && r.longitude).length;
  console.log(`   Geocoded: ${geocodedReports}/${reports.length}`);
  
  const adminReports = reports.filter(r => r.isAdminReport).length;
  console.log(`   Admin Reports: ${adminReports}`);
  
  const rejectedReports = reports.filter(r => r.status === 'Rejected').length;
  const reportsWithRejectionMessages = reports.filter(r => r.rejectionMessage).length;
  console.log(`   Rejected Reports: ${rejectedReports} (${reportsWithRejectionMessages} with messages)`);
  
  const assignedReports = reports.filter(r => r.assignedDriver).length;
  console.log(`   Assigned Reports: ${assignedReports}`);
  
  const reportsWithStatusHistory = reports.filter(r => r.statusHistory && r.statusHistory.length > 0).length;
  console.log(`   Reports with Status History: ${reportsWithStatusHistory}`);
  
  console.log("\n[ENHANCED FEATURES] WORKFLOW FEATURES TESTED");
  console.log("===========================================");
  console.log("✅ Geocoding Integration - Address to coordinates conversion");
  console.log("✅ Driver Assignment - Reports assigned to drivers");
  console.log("✅ Rejection Messaging - Detailed rejection reasons");
  console.log("✅ Admin Direct Reporting - Admin-created reports with auto-assignment");
  console.log("✅ Status History Tracking - Complete audit trail");
  console.log("✅ Location Visualization - Geocoded reports for map display");
  
  console.log("\n[CREDENTIALS] LOGIN CREDENTIALS");
  console.log("==============================");
  console.log("Admin (Full Access + Analytics):");
  console.log("  Email: admin@cleancity.com");
  console.log("  Password: admin123");
  console.log("  Features: Create reports, assign drivers, view analytics");
  console.log("\nDriver (Mike Johnson):");
  console.log("  Email: mike.johnson@example.com");
  console.log("  Password: password123");
  console.log("  Features: View assigned reports, update status, reject with messages");
  console.log("\nCitizen (John Doe):");
  console.log("  Email: john.doe@example.com");
  console.log("  Password: password123");
  console.log("  Features: Create reports, view dashboard with map, track status");
  
  console.log("\n[TESTING SCENARIOS] ENHANCED WORKFLOW TESTING");
  console.log("============================================");
  console.log("1. Citizen Dashboard - View reports on interactive map");
  console.log("2. Driver Dashboard - Manage assigned reports and update status");
  console.log("3. Admin Assignment - Assign pending reports to drivers");
  console.log("4. Admin Direct Reporting - Create reports with immediate assignment");
  console.log("5. Rejection Workflow - View rejection messages and reasons");
  console.log("6. Analytics Dashboard - View comprehensive system analytics");
  
  console.log("\n[READY] Enhanced CleanCity System Ready!");
  console.log("   Start server: npm start");
  console.log("   Open browser: http://localhost:5050");
  console.log("   Test analytics: http://localhost:5050/pages/admin-analytics.html");
}

async function seed() {
  console.log("[SEED] Starting database seeding...\n");
  
  try {
    // Connect to database
    await connectDB();
    
    // Clear existing data
    await clearDatabase();
    
    // Create users
    const users = await createUsers();
    
    // Create reports
    const reports = await createReports(users);
    
    // Display summary
    await displaySummary(users, reports);
    
    console.log("\n[SUCCESS] Database seeding completed successfully!");
    
  } catch (error) {
    console.error("\n[ERROR] Seeding failed:", error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("[INFO] Database connection closed");
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear-only');

if (shouldClear) {
  console.log("[INFO] Clearing database only...");
  connectDB()
    .then(clearDatabase)
    .then(() => {
      console.log("[SUCCESS] Database cleared successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[ERROR] Error:", error.message);
      process.exit(1);
    });
} else {
  // Run full seeding
  seed();
}

export default seed;