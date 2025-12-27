const form = document.getElementById("report-form");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // 1. Get the token from localStorage (user OR admin)
  const token =
    localStorage.getItem("userToken") || localStorage.getItem("adminToken");

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
