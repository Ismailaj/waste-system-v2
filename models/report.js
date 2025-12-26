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
  },
  {
    timestamps: true,
  }
);

const Report = mongoose.model("Report", reportSchema);
export default Report;
