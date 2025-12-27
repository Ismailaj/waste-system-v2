// // import fetch from "node-fetch"; // Using native fetch

// const testAdminAPI = async () => {
//   try {
//     console.log("1. Logging in as Admin...");
//     const loginRes = await fetch("http://localhost:5050/api/users/login", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         email: "admin@wastewise.com",
//         password: "admin123",
//       }),
//     });

//     const loginData = await loginRes.json();

//     if (!loginData.success) {
//       console.error("Login Failed:", loginData.message);
//       return;
//     }

//     console.log("Login Successful. Token received.");
//     const token = loginData.token;

//     console.log("2. Fetching Reports...");
//     const reportsRes = await fetch("http://localhost:5050/api/users/reports", {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     if (reportsRes.status !== 200) {
//       console.error(`API Error: Status ${reportsRes.status}`);
//       const text = await reportsRes.text();
//       console.error("Response:", text);
//       return;
//     }

//     const reportsData = await reportsRes.json();
//     console.log("API Response Success:", reportsData.success);
//     console.log(
//       "Reports Count:",
//       reportsData.reports ? reportsData.reports.length : "undefined"
//     );

//     if (reportsData.reports && reportsData.reports.length > 0) {
//       console.log(
//         "First Report:",
//         JSON.stringify(reportsData.reports[0], null, 2)
//       );
//     }
//   } catch (error) {
//     console.error("Test Script Error:", error);
//   }
// };

// testAdminAPI();
