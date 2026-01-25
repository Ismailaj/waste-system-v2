import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Report from "../models/report.js";
import { authenticate, authenticateAdmin } from "../middleware/auth.js";
import upload from "../config/multer.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import mongoose from "mongoose";

const router = express.Router();

// registering new user. Signup page
router.get("/public-stats", async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const completedPickups = await Report.countDocuments({
      status: { $in: ["Completed", "Resolved"] },
    });
    const activeMembers = await User.countDocuments();

    res.status(200).json({
      success: true,
      stats: {
        totalReports,
        completedPickups,
        activeMembers,
      },
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// registering new user. Signup page
router.post("/signup", upload.single("license"), async (req, res) => {
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

    let licenseUrl = "";
    let isVerified = true; // Default to true for non-drivers

    if (role === "driver") {
      isVerified = false; // Drivers need verification
      if (req.file) {
        try {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "driver_licenses",
          });
          licenseUrl = result.secure_url;
          fs.unlinkSync(req.file.path); // Delete local file
        } catch (uploadError) {
          console.error("License upload error:", uploadError);
          return res.status(500).json({ success: false, message: "Error uploading license" });
        }
      } else {
        // Assume license is mandatory for drivers
         return res.status(400).json({ success: false, message: "Driver license is required" });
      }
    }

    //encrypt passsword or hash
    const encryptedPassword = await bcrypt.hash(password, 10);

    //create user
    const newUser = await User.create({
      fullname,
      email,
      password: encryptedPassword,
      role: role || "citizen",
      licenseUrl,
      isVerified,
    });

    const user = newUser.toObject();
    delete user.password;

    res.status(201).json({
      success: true,
      message: role === 'driver' ? "Driver registered successfully. Please wait for admin verification." : "User registered successfully",
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

    // Check if user is a driver and is verified
    if (user.role === 'driver' && !user.isVerified) {
        return res.status(403).json({
            success: false,
            message: "Account pending verification. Please wait for admin approval.",
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
        category,
        address,
        description,
        photos: photoUrls, // save array of image URLs
        status: "Pending",
        user: req.user.id,
        ...adminFields,
      });

      res.status(201).json({
        success: true,
        message: "Report submitted successfully",
        report: newReport,
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
    console.log("Server Dashboard Request for UserID:", userId);

    // 2. Finds all reports in MongoDB where the 'user' field matches this ID.
    // .sort({ createdAt: -1 }) puts the newest reports at the top of the list.
    
    // Safety check: Ensure userId is valid
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
       console.error("Dashboard Error: Invalid User ID:", userId);
       return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    const reports = await Report.find({ user: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });

    // 3. Calculates 'Total Reports' by getting the length of the reports array.
    const totalReports = reports.length;

    // 4. Uses .filter() to count how many reports have the status "Completed".
    const resolvedIncidents = reports.filter(
      (r) => r.status === "Completed" || r.status === "Resolved"
    ).length;

    // 5. Counts reports that are still "Pending" or "In Progress".
    const inProgress = reports.filter(
      (r) => r.status === "Pending" || r.status === "In Progress"
    ).length;

    // 6. Sends all the stats and the full list of reports back to the frontend.
    res.set('Cache-Control', 'no-store'); // Prevent caching
    
    res.status(200).json({
      success: true,
      stats: { totalReports, resolvedIncidents, inProgress },
      reports,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching dashboard" });
  }
});

// ADMIN ROUTES
// Get all reports (Admin only)
// End of user routes
// Admin routes moved to adminRoutes.js

export default router;
