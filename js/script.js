
const FedhaAPI = (() => {
  let csrfToken = null;

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }

  async function initialize() {
    const data = await request("api/csrf.php");
    csrfToken = data.csrfToken;
  }

  async function register(name, email, password) {
    return request("api/register.php", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });
  }

  async function login(email, password) {
    const data = await request("api/login.php", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    csrfToken = data.csrfToken;
    return data;
  }

  async function currentUser() {
    return request("api/me.php");
  }

  async function logout() {
    const data = await request("api/logout.php", {
      method: "POST",
      body: JSON.stringify({})
    });

    csrfToken = null;
    return data;
  }

  return {
    initialize,
    register,
    login,
    currentUser,
    logout
  };
})();
