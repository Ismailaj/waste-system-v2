const form = document.getElementById("loginform");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const messageElement = document.getElementById("message");

  try {
    const response = await fetch("http://localhost:5050/api/users/login", {
      method: "POST",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      localStorage.removeItem("adminToken");
      // localStorage.removeItem("user");
      localStorage.removeItem("adminUser");

      if (data.user.role === "admin") {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        window.location.href = "admin.html";
      } else if (data.user.role === "driver") {
        localStorage.setItem("driverToken", data.token); // Distinct key
        localStorage.setItem("driverUser", JSON.stringify(data.user)); // Distinct key
        window.location.href = "driver.html";
      } else {
        console.log("Saving citizen data to localStorage...");
        localStorage.setItem("userToken", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "dashboard.html";

      }
      messageElement.textContent = "Login successful: " + data?.message;
      console.log("Login successful:" + data?.message);
    } else messageElement.textContent = data.message;
  } catch (error) {
    messageElement.textContent = "Couldn't establish connection";
    console.log("Error encountered : ", error);
  }
});
