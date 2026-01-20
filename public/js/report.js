const form = document.getElementById("report-form");

// Error handling utilities
function showMessage(message, isError = false) {
  const messageElement = document.getElementById("message");
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.className = isError ? 
      "text-center text-sm mt-4 font-medium text-red-600" : 
      "text-center text-sm mt-4 font-medium text-green-600";
  }
}

function setFormDisabled(disabled) {
  const submitButton = form.querySelector('button[type="submit"]');
  const inputs = form.querySelectorAll('input, select, textarea');
  
  inputs.forEach(input => input.disabled = disabled);
  if (submitButton) {
    submitButton.disabled = disabled;
    submitButton.textContent = disabled ? 'Submitting...' : 'Submit Report';
  }
}

function validateForm() {
  const category = document.getElementById("select")?.value;
  const address = document.getElementById("address")?.value?.trim();
  const description = document.getElementById("description")?.value?.trim();
  const photos = document.getElementById("file-upload")?.files;

  const errors = [];

  if (!category) {
    errors.push("Please select a waste category.");
  }

  if (!address) {
    errors.push("Please enter the location address.");
  } else if (address.length < 5) {
    errors.push("Please enter a more detailed address.");
  }

  if (!description) {
    errors.push("Please provide a description of the waste issue.");
  } else if (description.length < 10) {
    errors.push("Please provide a more detailed description (at least 10 characters).");
  }

  // Validate file uploads
  if (photos && photos.length > 0) {
    const maxFiles = 5;
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (photos.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} photos allowed.`);
    }

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      
      if (!allowedTypes.includes(file.type)) {
        errors.push(`File "${file.name}" is not a valid image type. Please use JPG, PNG, GIF, or WebP.`);
      }
      
      if (file.size > maxFileSize) {
        errors.push(`File "${file.name}" is too large. Maximum size is 5MB.`);
      }
    }
  }

  return errors;
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      // Validate form data
      const validationErrors = validateForm();
      if (validationErrors.length > 0) {
        showMessage(validationErrors[0], true);
        return;
      }

      // Check authentication
      const token = localStorage.getItem("userToken") || localStorage.getItem("adminToken");
      if (!token) {
        showMessage("You must be logged in to submit a report.", true);
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
        return;
      }

      // Get form data
      const category = document.getElementById("select").value;
      const address = document.getElementById("address").value.trim();
      const description = document.getElementById("description").value.trim();
      const photos = document.getElementById("file-upload").files;

      // Create FormData
      const formData = new FormData();
      formData.append("category", category);
      formData.append("address", address);
      formData.append("description", description);

      // Add photos with validation
      for (let i = 0; i < photos.length; i++) {
        formData.append("photos", photos[i]);
      }

      // Disable form during submission
      setFormDisabled(true);
      showMessage("Submitting your report...");

      // Submit with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for file uploads

      const response = await fetch("http://localhost:5050/api/users/report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server. Please try again.");
      }

      console.log("Report response:", response.status, data);

      if (response.ok && data.success) {
        showMessage("Report submitted successfully!");
        
        // Show geocoding status if available
        if (data.geocoding) {
          if (data.geocoding.success) {
            console.log("Location geocoded successfully:", data.geocoding.coordinates);
          } else {
            console.warn("Geocoding failed:", data.geocoding.error);
            showMessage("Report submitted successfully! Note: Location could not be geocoded for map display.");
          }
        }
        
        // Reset form after successful submission
        form.reset();
        
        // Redirect after delay
        setTimeout(() => {
          const user = JSON.parse(localStorage.getItem("user") || localStorage.getItem("adminUser") || "{}");
          if (user.role === "admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }, 2000);

      } else {
        // Handle API errors
        const errorMessage = data?.message || "Report submission failed. Please try again.";
        showMessage(errorMessage, true);
        
        // Handle specific error cases
        if (response.status === 401) {
          setTimeout(() => {
            window.location.href = "login.html";
          }, 2000);
        }
      }

    } catch (error) {
      console.error("Report submission error:", error);
      
      // Handle different types of errors
      let errorMessage = "Failed to submit report. Please try again.";
      
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. Please check your connection and try again.";
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = "Network error: Could not submit report. Please check your internet connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showMessage(errorMessage, true);
      
    } finally {
      // Re-enable form
      setFormDisabled(false);
    }
  });

  // Add real-time validation feedback
  const addressInput = document.getElementById("address");
  const descriptionInput = document.getElementById("description");
  
  if (addressInput) {
    addressInput.addEventListener("blur", () => {
      const address = addressInput.value.trim();
      if (address && address.length < 5) {
        addressInput.style.borderColor = "#ef4444";
      } else {
        addressInput.style.borderColor = "";
      }
    });
  }
  
  if (descriptionInput) {
    descriptionInput.addEventListener("input", () => {
      const description = descriptionInput.value.trim();
      const charCount = description.length;
      const minChars = 10;
      
      // You could add a character counter here
      if (charCount > 0 && charCount < minChars) {
        descriptionInput.style.borderColor = "#ef4444";
      } else {
        descriptionInput.style.borderColor = "";
      }
    });
  }

} else {
  console.error("Report form not found");
}
