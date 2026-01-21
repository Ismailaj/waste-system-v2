const form = document.getElementById("report-form");

// Check for admin role and show fields
document.addEventListener("DOMContentLoaded", async () => {
  const adminToken = localStorage.getItem("adminToken");
  const adminUser = localStorage.getItem("adminUser");

  const token = adminToken || localStorage.getItem("userToken");
  const isAdmin = !!adminToken;

  if (isAdmin && token) {
    const adminFields = document.getElementById("admin-fields");
    const title = document.querySelector("h1");
    const cancelBtn = document.getElementById("admin-cancel");
    if (adminFields) adminFields.classList.remove("hidden");
    title.textContent = "Admin Report";
    cancelBtn.classList.remove("hidden");
    cancelBtn.addEventListener("click", () => {
      window.location.href = "admin.html";
    });

    // Fetch drivers
    try {
      const res = await fetch("http://localhost:5050/api/users/drivers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const driverSelect = document.getElementById("assign-driver");
        data.drivers.forEach((driver) => {
          const option = document.createElement("option");
          option.value = driver._id;
          option.textContent = driver.fullname;
          driverSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // 1. Get the token from localStorage (user OR admin)
  const token =
    localStorage.getItem("adminToken") || localStorage.getItem("userToken");

  // 2. If no token, redirect to login
  if (!token) {
    alert("You must be logged in to submit a report.");
    window.location.href = "login.html";
    return;
  }

  const category = document.getElementById("select").value;
  const address = document.getElementById("address").value;
  const description = document.getElementById("description").value;

  const photos = document.getElementById("file-upload").files;

  const formData = new FormData();
  formData.append("category", category);
  formData.append("address", address);
  formData.append("description", description);

  // Admin fields
  const priority = document.getElementById("priority");
  if (priority && priority.offsetParent !== null) {
    // Check if visible
    formData.append("priority", priority.value);
  }

  const assignedDriver = document.getElementById("assign-driver");
  if (
    assignedDriver &&
    assignedDriver.offsetParent !== null &&
    assignedDriver.value
  ) {
    formData.append("assignedDriver", assignedDriver.value);
  }

  // const internalNotes = document.getElementById("internal-notes");
  // if (
  //   internalNotes &&
  //   internalNotes.offsetParent !== null &&
  //   internalNotes.value
  // ) {
  //   formData.append("internalNotes", internalNotes.value);
  // }

  for (let i = 0; i < photos.length; i++) {
    formData.append("photos", photos[i]);
  }

  try {
    const res = await fetch("http://localhost:5050/api/users/report", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();
    console.log("Report response:", res.status, data);

    const messageElement = document.getElementById("message");

    if (res.ok && data.success) {
      messageElement.textContent = "Report submitted successfully!";
      messageElement.className =
        "text-center text-sm mt-4 font-medium text-green-600";
      form.reset(); // clear the form
    } else {
      messageElement.textContent = data.message || "Submission failed";
      messageElement.className =
        "text-center text-sm mt-4 font-medium text-red-600";
    }
  } catch (err) {
    console.error("Network error submitting report:", err);
    const messageElement = document.getElementById("message");
    messageElement.textContent = "Network error: could not submit report";
    messageElement.className =
      "text-center text-sm mt-4 font-medium text-red-600";
  }
});
