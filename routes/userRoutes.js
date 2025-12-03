import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// registering new user. Signup page
router.post("/signup", async (req, res) => {
  try {
    const { fullname, email, password } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    //check if the user exists
    const userExists = await User.findOne({ email }); //pauses here until the promise finishes
    if (userExists) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registaerd" });
    }

    //encrypt passsword or hash
    const encryptedPassword = await bcrypt.hash(password, 10);

    //create user
    const newUser = await User.create({
      fullname,
      email,
      password: encryptedPassword,
    });

    const user = newUser.toObject();
    delete user.password;

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      // user: newUser
      user,
    });
    console.log(user);
  } catch (error) {
    console.log("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// logs a user in
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // check if all fields are flled
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    } else if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "Password is required" });
    }

    // find a user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found. Check your email and try again",
      });
    }

    // return res
    //   .status(200)
    //   .json({ success: true, message: "Good! next is password check" });

    // now check if passed password match stored one
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password. Input correct password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "my-secret-token",
      { expiresIn: "1h" }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      success: true,
      message: "Login Successful",
      user: userResponse,
      token,
    });
  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/report", async (req, res) => {
  const { typeOfWaste, description, location } = req.body; 
});

export default router;
