import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Report from "../models/report.js";
import { authenticate, authenticateAdmin } from "../middleware/auth.js";
import upload from "../config/multer.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import { geocodeAddress } from "../utils/geocoding.js";

const router = express.Router();

// registering new user. Signup page
router.post("/signup", async (req, res) => {
  try {
    const { fullname, email, password, role } = req.body;
    console.log("Signup Request:", req.body); // Debug log

    if (!fullname || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    //check if the user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    //encrypt passsword or hash
    const encryptedPassword = await bcrypt.hash(password, 10);

    //create user
    const newUser = await User.create({
      fullname,
      email,
      password: encryptedPassword,
      role: role || "citizen",
    });

    const user = newUser.toObject();
    delete user.password;

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      // user: newUser
      user,
    });
    console.log(user);
  } catch (error) {
    console.log("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// logs a user in
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // check if all fields are filled
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    } else if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "Password is required" });
    }

    // find a user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found. Check your email and try again",
      });
    }

    // now check if passed password match stored one
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password. Input correct password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "my-secret-token",
      { expiresIn: "1h" }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      success: true,
      message: "Login Successful",
      user: userResponse,
      token,
    });
  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post(
  "/report",
  authenticate,
  upload.array("photos", 5),
  async (req, res) => {
    try {
      console.log(
        "Report route hit. Content-Type:",
        req.headers["content-type"]
      );
      console.log("Request body:", req.body);
      const { category, address, description } = req.body;

      if (!category || !address) {
        return res.status(400).json({
          success: false,
          message: "Category and address are required",
        });
      }

      const validWasteTypes = [
        "recyclable",
        "illegal_dumping",
        "hazardous_waste",
      ];
      if (!validWasteTypes.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid waste type",
        });
      }

      // Geocode the address to get coordinates
      console.log("Geocoding address:", address);
      const geocodingResult = await geocodeAddress(address);
      
      if (!geocodingResult.success) {
        console.log("Geocoding failed:", geocodingResult.error);
        // Continue with report creation even if geocoding fails
      } else {
        console.log("Geocoding successful:", geocodingResult.latitude, geocodingResult.longitude);
      }

      // an array to store the photos
      const photoUrls = [];
      if (req.files && req.files.length > 0) {
        console.log("Files received:", req.files);

        for (const file of req.files) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "waste_reports",
          });
          console.log("Uploading:", file.path);

          photoUrls.push(result.secure_url);

          // delete local file after upload
          fs.unlinkSync(file.path);
        }
      }

<<<<<<< HEAD
      // Admin-only fields
      let adminFields = {};
      if (req.user.role === "admin") {
        const { priority, assignedDriver } = req.body;
        if (priority) adminFields.priority = priority;
        if (assignedDriver) {
          adminFields.assignedDriver = assignedDriver;
          // adminFields.status = "In Progress"; // User requested to keep it as Pending on dashboard
        }
      }

      const newReport = await Report.create({
=======
      // Create report with geocoding data
      const reportData = {
>>>>>>> pr-2
        category,
        address,
        description,
        photos: photoUrls, // save array of image URLs
        status: "Pending",
        user: req.user.id,
<<<<<<< HEAD
        ...adminFields,
      });
=======
      };

      // Add coordinates if geocoding was successful
      if (geocodingResult.success) {
        reportData.latitude = geocodingResult.latitude;
        reportData.longitude = geocodingResult.longitude;
      }

      const newReport = await Report.create(reportData);
>>>>>>> pr-2

      res.status(201).json({
        success: true,
        message: "Report submitted successfully",
        report: newReport,
        geocoding: {
          success: geocodingResult.success,
          coordinates: geocodingResult.success ? {
            latitude: geocodingResult.latitude,
            longitude: geocodingResult.longitude
          } : null,
          error: geocodingResult.success ? null : geocodingResult.error
        }
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.get("/dashboard", authenticate, async (req, res) => {
  try {
    // 1. Gets the logged-in user's ID from the token (via middleware).
    const userId = req.user.id;

    // 2. Finds all reports in MongoDB where the 'user' field matches this ID.
    // .sort({ createdAt: -1 }) puts the newest reports at the top of the list.
    const reports = await Report.find({ user: userId })
      .populate("rejectedBy", "fullname role")
      .sort({ createdAt: -1 });

    // 3. Calculates 'Total Reports' by getting the length of the reports array.
    const totalReports = reports.length;

    // 4. Uses .filter() to count how many reports have the status "Completed".
    const resolvedIncidents = reports.filter(
      (r) => r.status === "Completed" || r.status === "Resolved"
    ).length;

    // 5. Counts reports that are still "Pending" or "In Progress".
    const inProgress = reports.filter(
      (r) => r.status === "Pending" || r.status === "In Progress" || r.status === "Assigned"
    ).length;

    // 6. Get reports with coordinates for map display (last 3)
    const reportsWithCoordinates = reports.filter(
      (r) => r.latitude != null && r.longitude != null
    ).slice(0, 3); // Get the 3 most recent reports with coordinates

    // 7. Prepare map data
    const mapData = reportsWithCoordinates.map(report => ({
      id: report._id,
      latitude: report.latitude,
      longitude: report.longitude,
      address: report.address,
      category: report.category,
      status: report.status,
      createdAt: report.createdAt,
      description: report.description
    }));

    // 8. Sends all the stats, reports, and map data back to the frontend.
    res.status(200).json({
      success: true,
      stats: { totalReports, resolvedIncidents, inProgress },
      reports,
      mapData: {
        locations: mapData,
        hasLocations: mapData.length > 0,
        totalWithCoordinates: reports.filter(r => r.latitude != null && r.longitude != null).length
      }
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching dashboard" });
  }
});

// ADMIN DIRECT REPORTING
// Admin report creation with automatic driver assignment
router.post(
  "/admin/report",
  authenticate,
  authenticateAdmin,
  upload.array("photos", 5),
  async (req, res) => {
    try {
      console.log("Admin report route hit");
      const { category, address, description, assignedDriverId } = req.body;

      if (!category || !address) {
        return res.status(400).json({
          success: false,
          message: "Category and address are required",
        });
      }

      if (!assignedDriverId) {
        return res.status(400).json({
          success: false,
          message: "Driver assignment is required for admin reports",
        });
      }

      // Validate driver exists and has correct role
      const driver = await User.findById(assignedDriverId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Assigned driver not found"
        });
      }

      if (driver.role !== "driver") {
        return res.status(400).json({
          success: false,
          message: "Assigned user is not a driver"
        });
      }

      const validWasteTypes = [
        "recyclable",
        "illegal_dumping",
        "hazardous_waste",
      ];
      if (!validWasteTypes.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid waste type",
        });
      }

      // Geocode the address to get coordinates
      console.log("Geocoding address for admin report:", address);
      const geocodingResult = await geocodeAddress(address);
      
      if (!geocodingResult.success) {
        console.log("Geocoding failed for admin report:", geocodingResult.error);
      } else {
        console.log("Geocoding successful for admin report:", geocodingResult.latitude, geocodingResult.longitude);
      }

      // Handle photo uploads
      const photoUrls = [];
      if (req.files && req.files.length > 0) {
        console.log("Files received for admin report:", req.files);

        for (const file of req.files) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "waste_reports",
          });
          console.log("Uploading admin report photo:", file.path);

          photoUrls.push(result.secure_url);

          // delete local file after upload
          fs.unlinkSync(file.path);
        }
      }

      // Create admin report with automatic assignment
      const reportData = {
        category,
        address,
        description,
        photos: photoUrls,
        status: "Assigned", // Admin reports start as Assigned
        user: req.user.id, // Admin who created the report
        assignedDriver: assignedDriverId,
        isAdminReport: true
      };

      // Add coordinates if geocoding was successful
      if (geocodingResult.success) {
        reportData.latitude = geocodingResult.latitude;
        reportData.longitude = geocodingResult.longitude;
      }

      const newReport = await Report.create(reportData);

      // Populate the response with driver and user details
      const populatedReport = await Report.findById(newReport._id)
        .populate("user", "fullname email role")
        .populate("assignedDriver", "fullname email");

      res.status(201).json({
        success: true,
        message: "Admin report recorded and assigned successfully",
        report: populatedReport,
        geocoding: {
          success: geocodingResult.success,
          coordinates: geocodingResult.success ? {
            latitude: geocodingResult.latitude,
            longitude: geocodingResult.longitude
          } : null,
          error: geocodingResult.success ? null : geocodingResult.error
        }
      });

    } catch (error) {
      console.error("Error creating admin report:", error);
      res.status(500).json({ 
        success: false, 
        message: "Server error creating admin report" 
      });
    }
  }
);

// ADMIN ROUTES
// Get all reports (Admin only)
router.get("/reports", authenticate, authenticateAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("user", "fullname email") // Includes reporter details
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, reports });
  } catch (error) {
    console.error("Error fetching all reports:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching reports" });
  }
});

// Get all users (Admin only)
router.get("/all", authenticate, authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["citizen", "admin"] } })
      .select("-password")
      .sort({ createdAt: -1 });
    console.log(
      "Returned users roles:",
      users.map((u) => u.role)
    );
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching users" });
  }
});

<<<<<<< HEAD
//get drivers
router.get("/drivers", authenticate, authenticateAdmin, async (req, res) => {
  try {
    const drivers = await User.find({ role: "driver" })
      .select("-password")
      .sort({ fullname: 1 });
    res.json({ success: true, drivers });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching drivers" });
=======
// Assign driver to report (Admin only)
router.post(
  "/reports/:id/assign",
  authenticate,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { driverId } = req.body;
      const { id } = req.params;

      if (!driverId) {
        return res.status(400).json({
          success: false,
          message: "Driver ID is required"
        });
      }

      // Validate that the driver exists and has the correct role
      const driver = await User.findById(driverId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found"
        });
      }

      if (driver.role !== "driver") {
        return res.status(400).json({
          success: false,
          message: "User is not a driver"
        });
      }

      // Find the report and check its current status
      const report = await Report.findById(id);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found"
        });
      }

      // Prevent assignment of completed or rejected reports
      if (report.status === "Completed" || report.status === "Resolved" || report.status === "Rejected") {
        return res.status(400).json({
          success: false,
          message: "Cannot assign completed or rejected reports"
        });
      }

      // Update the report with driver assignment
      const updatedReport = await Report.findByIdAndUpdate(
        id,
        {
          assignedDriver: driverId,
          status: "Assigned"
        },
        { new: true }
      ).populate("assignedDriver", "fullname email");

      res.status(200).json({
        success: true,
        message: "Driver assigned successfully",
        report: updatedReport
      });

    } catch (error) {
      console.error("Error assigning driver:", error);
      res.status(500).json({
        success: false,
        message: "Server error assigning driver"
      });
    }
  }
);

// Get list of available drivers (Admin only)
router.get("/drivers", authenticate, authenticateAdmin, async (req, res) => {
  try {
    const drivers = await User.find({ role: "driver" })
      .select("fullname email")
      .sort({ fullname: 1 });

    res.status(200).json({
      success: true,
      drivers
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching drivers"
    });
  }
});

// DRIVER ROUTES
// Get assigned reports for driver dashboard
router.get("/driver/reports", authenticate, async (req, res) => {
  try {
    // Verify user is a driver
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Driver role required."
      });
    }

    // Get reports assigned to this driver
    const reports = await Report.find({ assignedDriver: req.user.id })
      .populate("user", "fullname email")
      .sort({ createdAt: -1 });

    // Calculate stats
    const totalAssigned = reports.length;
    const completed = reports.filter(r => r.status === "Completed" || r.status === "Resolved").length;
    const pending = reports.filter(r => r.status === "Assigned" || r.status === "In Progress").length;
    const rejected = reports.filter(r => r.status === "Rejected").length;

    res.status(200).json({
      success: true,
      stats: {
        totalAssigned,
        completed,
        pending,
        rejected
      },
      reports
    });

  } catch (error) {
    console.error("Error fetching driver reports:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assigned reports"
    });
  }
});

// Update report status (Driver only - for assigned reports)
router.patch("/driver/reports/:id/status", authenticate, async (req, res) => {
  try {
    // Verify user is a driver
    if (req.user.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Driver role required."
      });
    }

    const { status, rejectionMessage } = req.body;
    const { id } = req.params;

    // Validate status
    const validDriverStatuses = ["In Progress", "Completed", "Rejected"];
    if (!validDriverStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Drivers can only set status to: In Progress, Completed, or Rejected"
      });
    }

    // Find the report and verify it's assigned to this driver
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    if (!report.assignedDriver || report.assignedDriver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update reports assigned to you."
      });
    }

    // Validate rejection message if status is Rejected
    if (status === "Rejected") {
      if (!rejectionMessage || rejectionMessage.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Rejection message is required when rejecting a report"
        });
      }

      if (rejectionMessage.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: "Rejection message must be at least 10 characters long"
        });
      }
    }

    // Update the report
    const updateData = { status };
    if (status === "Rejected" && rejectionMessage) {
      updateData.rejectionMessage = rejectionMessage.trim();
      updateData.rejectedAt = new Date();
      updateData.rejectedBy = req.user.id;
    }

    const updatedReport = await Report.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("user", "fullname email")
     .populate("assignedDriver", "fullname email")
     .populate("rejectedBy", "fullname role");

    res.status(200).json({
      success: true,
      message: `Report status updated to ${status}`,
      report: updatedReport
    });

  } catch (error) {
    console.error("Error updating report status:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating report status"
    });
>>>>>>> pr-2
  }
});

// Update report status (Admin only)
router.patch(
  "/reports/:id/status",
  authenticate,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;
      const { id } = req.params;

      const validStatuses = [
        "Pending",
        "In Progress",
        "Assigned",
        "Completed",
        "Resolved",
        "Rejected",
      ];
      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }

      const report = await Report.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );

      if (!report) {
        return res
          .status(404)
          .json({ success: false, message: "Report not found" });
      }

      res
        .status(200)
        .json({ success: true, message: "Status updated", report });
    } catch (error) {
      console.error("Error updating status:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error updating status" });
    }
  }
);

// Assign driver to report (Admin only)
router.patch(
  "/reports/:id/assign",
  authenticate,
  authenticateAdmin,
  async (req, res) => {
    try {
      const { driverId } = req.body;
      const { id } = req.params;

      if (!driverId) {
        return res
          .status(400)
          .json({ success: false, message: "Driver ID is required" });
      }

      const report = await Report.findById(id);
      if (!report) {
        return res
          .status(404)
          .json({ success: false, message: "Report not found" });
      }

      report.assignedDriver = driverId;
      // Optionally update status to In Progress
      if (report.status === "Pending") {
        report.status = "In Progress";
      }

      await report.save();

      res
        .status(200)
        .json({ success: true, message: "Driver assigned successfully" });
    } catch (error) {
      console.error("Error assigning driver:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
