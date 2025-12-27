// import fetch from "node-fetch";

const testStatusUpdate = async () => {
  try {
    console.log("1. Logging in as Admin...");
    const loginRes = await fetch("http://localhost:5050/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@wastewise.com",
        password: "admin123",
      }),
    });

    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.error("Login Failed:", loginData.message);
      return;
    }
    const token = loginData.token;

    console.log("2. Fetching Reports to get an ID...");
    const reportsRes = await fetch("http://localhost:5050/api/users/reports", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reportsData = await reportsRes.json();

    if (!reportsData.reports || reportsData.reports.length === 0) {
      console.error("No reports found to test update.");
      return;
    }

    const reportId = reportsData.reports[0]._id;
    console.log(`Testing update on Report ID: ${reportId}`);

    console.log("3. Attempting to set status to 'Completed'...");
    const updateRes = await fetch(
      `http://localhost:5050/api/users/reports/${reportId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "Completed" }),
      }
    );

    const updateData = await updateRes.json();
    if (updateData.success) {
      console.log("SUCCESS: Status updated to 'Completed'.");
      console.log("Report:", updateData.report);
    } else {
      console.error("FAILURE: Could not update status.");
      console.error("Message:", updateData.message);
    }
  } catch (error) {
    console.error("Test Script Error:", error);
  }
};

testStatusUpdate();
