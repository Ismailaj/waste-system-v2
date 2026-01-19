import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import User from "../models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB via", process.env.MONGO_URL);

    const adminEmail = "admin@wasteresolve.com";
    const adminPassword = "admin123";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    let user = await User.findOne({ email: adminEmail });

    if (user) {
      user.role = "admin";
      user.password = hashedPassword; // Reset password to ensure access
      await user.save();
      console.log(`Admin user updated: ${adminEmail}`);
    } else {
      user = await User.create({
        fullname: "System Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
      });
      console.log(`Admin user created: ${adminEmail}`);
    }

    console.log(
      `\ncredentials:\nEmail: ${adminEmail}\nPassword: ${adminPassword}`
    );
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
};

createAdmin();
