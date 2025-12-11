export async function login(username: string) {
  const response = await fetch("http://localhost:8000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  return response.json(); // { access_token, user_id }
}
