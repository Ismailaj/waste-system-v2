import mongoose from "mongoose";

//define schema for user
const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true, //a name has gotta be there
    },

    email: {
      type: String,
      required: true,
      unique: true, //ensures no two users use the same email
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["citizen", "admin", "driver"],
      default: "citizen",
    },

    licenseUrl: {
      type: String, // URL from cloudinary
    },

    isVerified: {
      type: Boolean,
      default: false, // Default to false for everyone, but only matters for drivers
    },
  },

  {
    timestamps: true, //automatically adds createdAt and updatedAt
  }
);

const User = mongoose.model("User", userSchema);
export default User;
