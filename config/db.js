import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Mongo connected successfully");
  } catch (error) {
    console.log("Mongo connection error:", error.message);
  }
};
export default connectDB;
