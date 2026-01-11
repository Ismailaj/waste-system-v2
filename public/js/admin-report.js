document.addEventListener("DOMContentLoaded", function() {
  // Check if user is admin
  const token = localStorage.getItem("adminToken");
  const user = JSON.parse(localStorage.getItem("adminUser") || "{}");

  if (!token || user.role !== "admin") {
    alert("Access denied. Admin role required.");
    window.location.href = "login.html";
    return;
  }

  // Load available drivers
  loadDrivers();

  // Setup form submission
  const form = document.getElementById("admin-report-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }

  // Setup logout button
  const logoutBtn = document.getElementById("logout-button");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to logout?")) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "login.html";
      }
    });
  }
});

async function loadDrivers() {
  const token = localStorage.getItem("adminToken");
  const driverSelect = document.getElementById("assignedDriverId");

  try {
    const response = await fetch("http://localhost:5050/api/users/drivers", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success && data.drivers.length > 0) {
      // Clear existing options except the first one
      driverSelect.innerHTML = '<option value="">Select Driver</option>';
      
      // Add driver options
      data.drivers.forEach(driver => {
        const option = document.createElement("option");
        option.value = driver._id;
        option.textContent = `${driver.fullname} (${driver.email})`;
        driverSelect.appendChild(option);
      });
    } else {
      driverSelect.innerHTML = '<option value="">No drivers available</option>';
      showMessage("No drivers available. Please ensure there are users with driver role.", "error");
    }
  } catch (error) {
    console.error("Error loading drivers:", error);
    showMessage("Error loading drivers. Please try again.", "error");
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const token = localStorage.getItem("adminToken");
  const form = e.target;
  const submitButton = form.querySelector('button[type="submit"]');
  
  // Disable submit button to prevent double submission
  submitButton.disabled = true;
  submitButton.textContent = "Recording Incident...";

  try {
    // Create FormData object to handle file uploads
    const formData = new FormData();
    
    // Add form fields
    formData.append("category", document.getElementById("category").value);
    formData.append("address", document.getElementById("address").value);
    formData.append("description", document.getElementById("description").value);
    formData.append("assignedDriverId", document.getElementById("assignedDriverId").value);
    
    // Add photos if any
    const photosInput = document.getElementById("photos");
    if (photosInput.files.length > 0) {
      for (let i = 0; i < photosInput.files.length; i++) {
        formData.append("photos", photosInput.files[i]);
      }
    }

    // Validate required fields
    if (!formData.get("category") || !formData.get("address") || !formData.get("assignedDriverId")) {
      showMessage("Please fill in all required fields.", "error");
      return;
    }

    // Submit the form
    const response = await fetch("http://localhost:5050/api/users/admin/report", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      showMessage("Incident recorded and assigned successfully!", "success");
      
      // Reset form
      form.reset();
      
      // Redirect to admin dashboard after a short delay
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 2000);
    } else {
      showMessage("Failed to record incident: " + data.message, "error");
    }

  } catch (error) {
    console.error("Error submitting admin report:", error);
    showMessage("Error recording incident. Please try again.", "error");
  } finally {
    // Re-enable submit button
    submitButton.disabled = false;
    submitButton.textContent = "Record Incident & Assign";
  }
}

function showMessage(message, type) {
  const messageContainer = document.getElementById("message-container");
  const messageDiv = document.getElementById("message");
  
  messageContainer.classList.remove("hidden");
  
  // Remove existing classes
  messageDiv.className = "p-4 rounded-md";
  
  // Add appropriate styling based on type
  if (type === "success") {
    messageDiv.classList.add("bg-green-100", "text-green-800", "border", "border-green-200");
  } else if (type === "error") {
    messageDiv.classList.add("bg-red-100", "text-red-800", "border", "border-red-200");
  } else {
    messageDiv.classList.add("bg-blue-100", "text-blue-800", "border", "border-blue-200");
  }
  
  messageDiv.textContent = message;
  
  // Auto-hide after 5 seconds for non-error messages
  if (type !== "error") {
    setTimeout(() => {
      messageContainer.classList.add("hidden");
    }, 5000);
  }
}