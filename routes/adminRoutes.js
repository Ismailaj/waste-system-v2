import express from "express";
import { authenticate, authenticateAdmin } from "../middleware/auth.js";
import User from "../models/User.js";
import Report from "../models/report.js";

const router = express.Router();

// Get all reports
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

// Get all users
router.get("/users/all", authenticate, authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["citizen", "admin"] } })
      .select("-password")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching users" });
  }
});

// Get all drivers
router.get("/users/drivers", authenticate, authenticateAdmin, async (req, res) => {
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

// Update report status
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

// Assign driver to report
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

// Get pending driver approvals
router.get("/drivers/pending", authenticate, authenticateAdmin, async (req, res) => {
  try {
    const pendingDrivers = await User.find({ role: "driver", isVerified: false })
      .select("-password")
      .sort({ createdAt: -1 });
    res.json({ success: true, drivers: pendingDrivers });
  } catch (error) {
    console.error("Error fetching pending drivers:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get available drivers (not currently assigned to an in-progress report)
router.get("/drivers/available", authenticate, authenticateAdmin, async (req, res) => {
  try {
    // 1. Find all reports that are "In Progress"
    const activeReports = await Report.find({ status: "In Progress" }).select("assignedDriver");
    const busyDriverIds = activeReports.map(r => r.assignedDriver && r.assignedDriver.toString()).filter(id => id);

    // 2. Find all drivers who are verified (or legacy) and NOT in the busy list
    // query: role=driver AND (isVerification=true OR isVerified doesn't exist) AND id not in busy
    const availableDrivers = await User.find({
      role: "driver",
      // Relaxed check: allows true OR undefined/null (legacy drivers)
      $or: [{ isVerified: true }, { isVerified: { $exists: false } }], 
      _id: { $nin: busyDriverIds }
    })
    .select("-password")
    .sort({ fullname: 1 });

    res.json({ success: true, drivers: availableDrivers });
  } catch (error) {
    console.error("Error fetching available drivers:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Verify driver (Approve/Reject)
router.patch("/drivers/:id/verify", authenticate, authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const driver = await User.findById(id);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    if (action === "approve") {
      driver.isVerified = true;
      await driver.save();
      return res.json({ success: true, message: "Driver approved successfully" });
    } else {
      await User.findByIdAndDelete(id);
      return res.json({ success: true, message: "Driver application rejected and removed" });
    }
  } catch (error) {
    console.error("Error verifying driver:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
