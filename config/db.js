import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Mongo connected successfully");
  } catch (error) {
    console.log("Mongo conection error:", error.message);
  }
//   process.exit(1);  //shuts the server down immediately after it starts running
};
export default connectDB;
