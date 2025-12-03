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
      messageElement.textContent = "Login successful: " + data?.message;
      // console.log("");
    } else messageElement.textContent = data.message;
  } catch (error) {
    messageElement.textContent = "Couldn't establish connection";
    console.log("Error encountered : ", error);
  }
});
