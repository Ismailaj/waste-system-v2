import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    address: { type: String, required: true },
    description: { type: String },
    photos: { type: [String], default: [] },
    status: { type: String, default: "Pending" },
    //link to the user who created the report
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // New fields for enhanced reporting workflow
    latitude: { type: Number },
    longitude: { type: Number },
    assignedDriver: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    rejectionMessage: { type: String },
    rejectedAt: { type: Date },
    rejectedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    isAdminReport: { type: Boolean, default: false }
  },
  {
    timestamps: true,
  }
);

// Add indexes for performance
reportSchema.index({ assignedDriver: 1 }); // For driver dashboard queries
reportSchema.index({ latitude: 1, longitude: 1 }); // For geospatial queries
reportSchema.index({ user: 1, createdAt: -1 }); // For user dashboard with recent reports
reportSchema.index({ status: 1 }); // For status-based filtering

const Report = mongoose.model("Report", reportSchema);
export default Report;
