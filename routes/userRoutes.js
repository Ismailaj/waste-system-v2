import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Report from "../models/report.js";
import { authenticate, authenticateAdmin } from "../middleware/auth.js";
import upload from "../config/multer.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

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

    // 2. Finds all reports in MongoDB where the 'user' field matches this ID.
    // .sort({ createdAt: -1 }) puts the newest reports at the top of the list.
    const reports = await Report.find({ user: userId }).sort({ createdAt: -1 });

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
