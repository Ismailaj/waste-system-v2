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
<<<<<<< HEAD
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    // internalNotes: {
    //   type: String,
    // },
=======
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
    isAdminReport: { type: Boolean, default: false },
    // Status history for workflow analysis
    statusHistory: [{
      status: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      changedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      },
      notes: { type: String }
    }]
>>>>>>> pr-2
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

// Additional indexes for analytics performance
reportSchema.index({ createdAt: 1, category: 1 }); // For trend analysis by category
reportSchema.index({ status: 1, assignedDriver: 1 }); // For driver performance analytics
reportSchema.index({ createdAt: 1, status: 1, category: 1 }); // For comprehensive analytics queries
reportSchema.index({ latitude: 1, longitude: 1, category: 1 }); // For geographic analytics by category
reportSchema.index({ 'statusHistory.timestamp': 1 }); // For status transition analytics

// Middleware to track status changes
reportSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    // Add status change to history
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      changedBy: this.modifiedBy || null, // This should be set by the calling code
      notes: this.statusChangeNotes || null // This should be set by the calling code
    });
    
    // Clear temporary fields
    this.modifiedBy = undefined;
    this.statusChangeNotes = undefined;
  } else if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    // Initialize status history for new reports only if not already set
    this.statusHistory = [{
      status: this.status || 'Pending',
      timestamp: this.createdAt || new Date(),
      changedBy: this.user,
      notes: 'Report created'
    }];
  }
  next();
});

// Virtual field for resolution time calculation
reportSchema.virtual('resolutionTime').get(function() {
  if (this.status === 'Completed' && this.statusHistory && this.statusHistory.length > 0) {
    const completed = this.statusHistory.find(h => h.status === 'Completed');
    const created = this.statusHistory.find(h => h.status === 'Pending') || this.statusHistory[0];
    return completed && created ? completed.timestamp - created.timestamp : null;
  }
  return null;
});

const Report = mongoose.model("Report", reportSchema);
export default Report;
