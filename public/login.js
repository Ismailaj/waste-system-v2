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
      // 1. SAVE the token: This stores the "ID card" in the browser so other pages can see it.
      localStorage.setItem("token", data.token);
      window.location.href = "dashboard.html"

      // 2. SAVE user info: Useful for showing "Welcome, Aj" without re-fetching.
      localStorage.setItem("user", JSON.stringify(data.user));
      messageElement.textContent = "Login successful: " + data?.message;
      console.log("Login successful:" + data?.message);
    } else messageElement.textContent = data.message;
  } catch (error) {
    messageElement.textContent = "Couldn't establish connection";
    console.log("Error encountered : ", error);
  }
});
