const form = document.getElementById("loginform");

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
  const inputs = form.querySelectorAll('input');
  
  inputs.forEach(input => input.disabled = disabled);
  if (submitButton) {
    submitButton.disabled = disabled;
    submitButton.textContent = disabled ? 'Logging in...' : 'Login';
  }
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      // Get and validate form data
      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");
      
      if (!emailInput || !passwordInput) {
        showMessage("Form elements not found. Please refresh the page.", true);
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Client-side validation
      if (!email) {
        showMessage("Please enter your email address.", true);
        emailInput.focus();
        return;
      }

      if (!password) {
        showMessage("Please enter your password.", true);
        passwordInput.focus();
        return;
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showMessage("Please enter a valid email address.", true);
        emailInput.focus();
        return;
      }

      // Disable form during submission
      setFormDisabled(true);
      showMessage("Logging in...");

      // API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch("http://localhost:5050/api/users/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle response
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Too many login attempts. Please try again later.");
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else if (response.status === 0) {
          throw new Error("Unable to connect to server. Please check your internet connection.");
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server. Please try again.");
      }

      if (response.ok && data.success) {
        // Validate response data
        if (!data.token || !data.user) {
          throw new Error("Invalid login response. Please try again.");
        }

        if (!data.user.role) {
          throw new Error("User role not found. Please contact support.");
        }

        // Store authentication data safely
        try {
          if (data.user.role === "admin") {
            localStorage.setItem("adminToken", data.token);
            localStorage.setItem("adminUser", JSON.stringify(data.user));
            showMessage("Admin login successful! Redirecting...");
            setTimeout(() => {
              window.location.href = "admin.html";
            }, 1000);
          } else {
            localStorage.setItem("userToken", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            showMessage("Login successful! Redirecting...");
            setTimeout(() => {
              window.location.href = "dashboard.html";
            }, 1000);
          }
        } catch (storageError) {
          console.error("Storage error:", storageError);
          throw new Error("Unable to save login information. Please try again.");
        }

      } else {
        // Handle API error responses
        const errorMessage = data?.message || "Login failed. Please check your credentials.";
        showMessage(errorMessage, true);
      }

    } catch (error) {
      console.error("Login error:", error);
      
      // Handle different types of errors
      let errorMessage = "Login failed. Please try again.";
      
      if (error.name === 'AbortError') {
        errorMessage = "Login request timed out. Please check your connection and try again.";
      } else if (error.message.includes('fetch')) {
        errorMessage = "Unable to connect to server. Please check your internet connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showMessage(errorMessage, true);
      
    } finally {
      // Re-enable form
      setFormDisabled(false);
    }
  });
} else {
  console.error("Login form not found");
}
