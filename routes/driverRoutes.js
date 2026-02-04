import express from "express";
import {
  authenticate,
  authenticateDriver,
  authenticateAdmin,
} from "../middleware/auth.js";
import Report from "../models/report.js";
import User from "../models/User.js";

const router = express.Router();

// ADMIN ROUTES FOR DRIVER VERIFICATION
// Moved to adminRoutes.js

// GET /api/driver/assigned - Get reports assigned to the logged-in driver
router.get("/assigned", authenticate, authenticateDriver, async (req, res) => {
  try {
    // Only fetch reports with Pending or In Progress status
    const reports = await Report.find({
      assignedDriver: req.user.id,
      status: { $in: ["Pending", "In Progress"] },
    })
      .populate("user", "fullname email") // Get details of the reporter
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error("Error fetching assigned reports:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/driver/:id/status - Update report status (and reason if rejected)
router.patch(
  "/:id/status",
  authenticate,
  authenticateDriver,
  async (req, res) => {
    const { status, rejectionReason } = req.body;

    // Validate inputs
    if (!["Completed", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status update" });
    }

    if (status === "Rejected" && !rejectionReason) {
      return res
        .status(400)
        .json({ message: "Rejection reason is required when rejecting" });
    }

    try {
      const report = await Report.findOne({
        _id: req.params.id,
        assignedDriver: req.user.id,
      });

      if (!report) {
        return res
          .status(404)
          .json({ message: "Report not found or not assigned to you" });
      }

      report.status = status;
      if (status === "Rejected") {
        report.rejectionReason = rejectionReason;
      }
      // If setting back to completed (or something else), maybe clear reason?
      // For now, let's just create logic. Ideally if completed, reason should be null.
      if (status === "Completed") {
        report.rejectionReason = null;
      }

      await report.save();
      res.json(report);
    } catch (error) {
      console.error("Error updating report status:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

export default router;
