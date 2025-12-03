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

// connect to Mongo
connectDB();

//activate Route
app.use("/api/users", router);

app.get("/", (req, res) => {
  res.send("System running suxxessfuly");
});
app.listen(process.env.PORT || 5000, () => {
  console.log(
    `Successful! Server running on port ${process.env.PORT || 5000} `
  );
});
