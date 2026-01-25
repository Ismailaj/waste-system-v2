const form = document.getElementById("signup");

function toggleLicenseUpload() {
  const role = document.getElementById("role").value;
  const licenseContainer = document.getElementById("license-container");
  if (role === "driver") {
    licenseContainer.classList.remove("hidden");
  } else {
    licenseContainer.classList.add("hidden");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullname = document.getElementById("fullname").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const messageElement = document.getElementById("message");
  const licenseInput = document.getElementById("license");

  messageElement.textContent = "";

  const formData = new FormData();
  formData.append("fullname", fullname);
  formData.append("email", email);
  formData.append("password", password);
  formData.append("role", role);

  if (role === "driver") {
    if (licenseInput.files.length > 0) {
      formData.append("license", licenseInput.files[0]);
    } else {
      messageElement.textContent = "Please upload your driver's license";
      return;
    }
  }

  try {
    const response = await fetch("http://localhost:5050/api/users/signup", {
      method: "POST",
      // Headers should not be set manually for FormData
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Fixed typo successs -> success
      messageElement.textContent = data.message;
      if (role === "driver") {
        form.reset();
        messageElement.classList.add("text-green-600");
      } else {
        form.reset();
        console.log(`${data.user.fullname} registered successfully`);
        // Redirect to login page after successful signup
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      }
    } else {
      messageElement.textContent = data.message;
      messageElement.classList.remove("text-green-600");
      messageElement.classList.add("text-red-600");
    }
  } catch (error) {
    messageElement.textContent = "Couldn't establish connection";
    console.log("Error encountered : ", error.message);
  }
});
