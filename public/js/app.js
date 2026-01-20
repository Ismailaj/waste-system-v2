const form = document.getElementById("signup");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullname = document.getElementById("fullname").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const messageElement = document.getElementById("message");

  messageElement.textContent = "";

  try {
    const response = await fetch("http://localhost:5050/api/users/signup", {
      method: "POST",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        fullname,
        email,
        password,
        role,
      }),
    });

    const data = await response.json();

    if (response.ok && data.successs) {
      messageElement.textContent = "Registraton Successful";
      console.log(`${data.fullname} registered successfully`);
    } else {
      messageElement.textContent = data.message;
    }
  } catch (error) {
    messageElement.textContent = "Couldn't establish connection";
    console.log("Error encountered : ", error.message);
  }
});
