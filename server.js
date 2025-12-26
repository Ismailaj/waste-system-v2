import express from "express"; //the backend framework
import cors from "cors"; //allows html to communicate with backend
import dotenv from "dotenv"; //imports my .env file
import connectDB from "./config/db.js"; //my connectDB function
import router from "./routes/userRoutes.js";

dotenv.config(); //load/process credentials from my .env file
const app = express(); //initialize express

//middleware
app.use(cors()); //allows frontend requests
//allows json data to be read from forms which by default isnt allowed without middleware
app.use(express.json());

// serve static frontend files
// app.use(express.static("public"));

// connect to Mongo (fail fast on DB errors)
connectDB().catch((err) => {
  console.error("Database connection failed:", err);
  process.exit(1);
});

//activate Route
app.use("/api/users", router);

app.get("/", (req, res) => {
  res.json("System running successfully");
});
app.listen(process.env.PORT || 5000, () => {
  console.log(
    `Successful! Server running on port ${process.env.PORT || 5000} `
  );
});
