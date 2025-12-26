import jwt from "jsonwebtoken"; // Imports the library to verify tokens.

const authenticate = (req, res, next) => {
  // 1. Looks for the "Authorization" header in the request (e.g., "Bearer 12345xyz").
  const token = req.headers.authorization?.split(" ")[1]; 

  // 2. If no token is found, it stops the request and sends a 401 (Unauthorized) error.
  if (!token) {
    return res.status(401).json({ success: false, message: "No token, authorization denied" });
  }

  try {
    // 3. Verifies the token using your secret key. If it's valid, it "decodes" the user info.
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "my-secret-token");

    // 4. Attaches the decoded user data (ID, email) to the "req" object so other routes can use it.
    req.user = decoded; 

    // 5. Moves the request forward to the actual route (like the report or dashboard route).
    next(); 
  } catch (err) {
    // 6. If the token is fake or expired, it sends an error.
    res.status(401).json({ success: false, message: "Token is not valid" });
  }
};



// middleware/auth.js

// This checks if the user is an admin.
// const isAdmin = (req, res, next) => {
//     // 1. We check the 'role' we attached to the 'req' object in the 'authenticate' middleware.
//     if (req.user && req.user.role === "admin") {
//         next(); // 2. If they are an admin, let them through.
//     } else {
//         // 3. If they are a citizen, block them!
//         res.status(403).json({ success: false, message: "Access denied. Admins only." });
//     }
// };

export default authenticate;
// export default isAdmin;