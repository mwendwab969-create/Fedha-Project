
"use strict";

/* Fedha: savings and budget management */

const $ = (id) => document.getElementById(id);
const API = "api";

const state = {
  user: null,
  page: "dashboard",
  busy: false,
  csrfToken: null
};

const currency = (amount) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES"
  }).format(Number(amount) || 0);

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API}/${endpoint}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
      ...(state.csrfToken
        ?{"x-CSRF-Token" : state.csrfToken}
     :{} )
    }
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success === false || result === null) {
    throw new Error(
      result?.error ||
      result?.message ||
      (result === null
        ? `The response from ${endpoint} was not valid JSON (HTTP ${response.status}). Check that PHP is running and the endpoint has no PHP errors.`
        : `Request to ${endpoint} failed (HTTP ${response.status}). Check that PHP is running and the endpoint exists.`)
    );
  }
  if (result.csrfToken) {
  state.csrfToken = result.csrfToken;
}
  

  return result;
}

function message(text, error = false) {
  if ($("msg")) {
    $("msg").textContent = text;
    $("msg").classList.toggle("error-message", error);
  }

  if ($("toast")) {
    $("toast").textContent = text;
    $("toast").classList.remove("hidden");
  }
}

function clearMessage() {
  if ($("msg")) $("msg").textContent = "";
  if ($("toast")) $("toast").classList.add("hidden");
}

function setBusy(value) {
  state.busy = value;

  document.querySelectorAll(
    "#loginForm button, #regForm button, #signupBtn"
  ).forEach((button) => {
    button.disabled = value;
  });
}

/* Login and registration */

function showTab(login) {
  $("loginForm").classList.toggle("hidden", !login);
  $("regForm").classList.toggle("hidden", login);

  $("tabLogin").setAttribute("aria-selected", String(login));
  $("tabReg").setAttribute("aria-selected", String(!login));

  clearMessage();
}

$("tabLogin").addEventListener("click", () => showTab(true));
$("tabReg").addEventListener("click", () => showTab(false));

$("signupBtn").addEventListener("click", () => {
  showTab(false);
  $("rName").focus();
});

$("lShow").addEventListener("change", (event) => {
  $("lPass").type = event.target.checked ? "text" : "password";
});

$("regForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;

  clearMessage();

  const name = $("rName").value.trim();
  const email = $("rEmail").value.trim();
  const password = $("rPass").value;
  const confirm = $("rConf").value;

  ["eName", "eEmail", "ePass", "eConf"].forEach((id) => {
    $(id).textContent = "";
  });

  let invalid = false;

  if (!name) {
    $("eName").textContent = "Enter your full name.";
    invalid = true;
  }

  if (!$("rEmail").checkValidity() || !email) {
    $("eEmail").textContent = "Enter a valid email address.";
    invalid = true;
  }

  if (password.length < 8) {
    $("ePass").textContent = "Use at least 8 characters.";
    invalid = true;
  }

  if (password !== confirm) {
    $("eConf").textContent = "Passwords do not match.";
    invalid = true;
  }

  if (invalid) return;

  setBusy(true);

  try {
    await apiRequest("register.php", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });

    $("regForm").reset();
    showTab(true);
    $("lEmail").value = email;
    message("Account created. Log in to continue.");
  } catch (error) {
    message(error.message, true);
  } finally {
    setBusy(false);
  }
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;

  clearMessage();

  const email = $("lEmail").value.trim();
  const password = $("lPass").value;

  if (!email || !$("lEmail").checkValidity() || !password) {
    message("Enter a valid email and password.", true);
    return;
  }

  setBusy(true);

  try {
    const result = await apiRequest("login.php", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    if (!result.user) {
      throw new Error("The server did not return an authenticated user.");
    }

    state.user = result.user;
    await openDashboard();
  } catch (error) {
    message(error.message, true);
  } finally {
    setBusy(false);
  }
});

/* Application navigation */

const pages = {
  dashboard: ["Overview", "Your financial position at a glance."],
  savings: ["Savings & Goals", "Build savings towards your goals."],
  transactions: ["Transactions", "Track your expenses and withdrawals."],
  budgets: ["Budgets", "Plan and monitor your expenditure."],
  reports: ["Financial Reports", "Review your financial progress."],
  settings: ["Account Settings", "Manage your Fedha account."]
};

function setAuthenticated(authenticated) {
  $("authView").classList.toggle("hidden", authenticated);
  $("appView").classList.toggle("hidden", !authenticated);
}

function updateProfile() {
  const name = state.user?.name || "User";
  $("profileName").textContent = name;
  $("avatar").textContent = name.charAt(0).toUpperCase();
}

async function openDashboard() {
  if (!state.user) return;

  setAuthenticated(true);
  updateProfile();
  await navigate("dashboard");
}

$("nav").querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    if (pages[page]) navigate(page);
  });
});

async function navigate(page) {
  if (!state.user || !pages[page]) return;

  state.page = page;

  $("nav").querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("pageTitle").textContent = pages[page][0];
  $("pageSub").textContent = pages[page][1];

  const view = $("view");
  view.innerHTML = '<p class="loading">Loading your records...</p>';

  try {
    if (page === "dashboard") await renderDashboard(view);
    if (page === "savings") await renderSavings(view);
    if (page === "transactions") await renderTransactions(view);
    if (page === "budgets") await renderBudgets(view);
    if (page === "reports") await renderReports(view);
    if (page === "settings") renderSettings(view);
  } catch (error) {
    view.innerHTML = `
      <section class="panel">
        <h3>Unable to load your records</h3>
        <p>${escapeHTML(error.message)}</p>
        <button class="button" id="retryBtn" type="button">Retry</button>
      </section>
    `;

    $("retryBtn").addEventListener("click", () => navigate(page));
  }
}

function progress(saved, target) {
  const goal = Number(target) || 0;
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((Number(saved || 0) / goal) * 100));
}

function panel(title, content) {
  return `
    <section class="panel">
      <h3>${title}</h3>
      ${content}
    </section>
  `;
}

/* Overview */

async function renderDashboard(view) {
  const data = await apiRequest("dashboard.php");
  const s = data.summary || {};

  view.innerHTML = `
    <div class="summary-grid">
      <article class="summary-card">
        <span>Total saved</span>
        <strong>${currency(s.totalSavings)}</strong>
      </article>
      <article class="summary-card">
        <span>Savings target</span>
        <strong>${currency(s.savingsTarget)}</strong>
      </article>
      <article class="summary-card">
        <span>Total expenses</span>
        <strong>${currency(s.totalExpenses)}</strong>
      </article>
      <article class="summary-card">
        <span>Total withdrawals</span>
        <strong>${currency(s.totalWithdrawals)}</strong>
      </article>
    </div>

    ${panel("Savings progress", `
      <p>${currency(s.totalSavings)} saved out of ${currency(s.savingsTarget)}</p>
      <progress max="100" value="${progress(s.totalSavings, s.savingsTarget)}"></progress>
      <p>${progress(s.totalSavings, s.savingsTarget)}% of your target</p>
      <button class="button" id="dashboardSavings" type="button">Manage savings</button>
    `)}

    ${panel("Recent transactions", transactionTable(data.recentTransactions || []))}
  `;

  $("dashboardSavings").addEventListener("click", () => navigate("savings"));
}

/* Savings goals */

async function renderSavings(view) {
  const data = await apiRequest("savings.php");
  const savings = data.savings || [];

  view.innerHTML = `
    ${panel("Create a savings goal", `
      <form id="savingsForm" class="form-grid">
        <label>Goal name
          <input id="goalName" maxlength="150" required placeholder="e.g. Tuition fees">
        </label>
        <label>Target amount (KES)
          <input id="goalTarget" type="number" min="0.01" step="0.01" required>
        </label>
        <label>Initial savings (KES)
          <input id="initialSavings" type="number" min="0" step="0.01" value="0" required>
        </label>
        <button class="button" type="submit">Create goal</button>
      </form>
    `)}

    ${panel("Your savings goals", savings.length ? savings.map((item) => `
      <article class="goal-card">
        <div class="goal-heading">
          <h4>${escapeHTML(item.goal)}</h4>
          <strong>${progress(item.saved_amount, item.target_amount)}%</strong>
        </div>
        <progress max="100" value="${progress(item.saved_amount, item.target_amount)}"></progress>
        <p>${currency(item.saved_amount)} saved of ${currency(item.target_amount)}</p>
        <form class="depositForm form-grid" data-id="${Number(item.id)}">
          <label>Deposit amount (KES)
            <input name="amount" type="number" min="0.01" step="0.01" required>
          </label>
          <button class="button" type="submit">Record deposit</button>
        </form>
      </article>
    `).join("") : "<p>You have no savings goals yet. Create your first goal above.</p>")}
  `;

  $("savingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const goal = $("goalName").value.trim();
    const target_amount = Number($("goalTarget").value);
    const saved_amount = Number($("initialSavings").value);

    if (!goal || target_amount <= 0 || saved_amount < 0 || saved_amount > target_amount) {
      message("Check the goal name and amounts.", true);
      return;
    }

    try {
      await apiRequest("savings.php", {
        method: "POST",
        body: JSON.stringify({ goal, target_amount, saved_amount })
      });
      message("Savings goal saved.");
      await navigate("savings");
    } catch (error) {
      message(error.message, true);
    }
  });

  view.querySelectorAll(".depositForm").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const amount = Number(new FormData(form).get("amount"));
      const savings_id = Number(form.dataset.id);

      if (amount <= 0 || !Number.isFinite(amount)) {
        message("Enter a valid deposit amount.", true);
        return;
      }

      try {
        await apiRequest("deposit.php", {
          method: "POST",
          body: JSON.stringify({ savings_id, amount })
        });
        message("Deposit recorded.");
        await navigate("savings");
      } catch (error) {
        message(error.message, true);
      }
    });
  });
}

/* Transaction history */

function transactionTable(records) {
  if (!records.length) return "<p>No transactions recorded yet.</p>";

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Description</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>
          ${records.map((item) => `
            <tr>
              <td>${escapeHTML(item.description)}</td>
              <td>${escapeHTML(item.type || "Transaction")}</td>
              <td>${currency(item.amount)}</td>
              <td>${escapeHTML(item.date || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function renderTransactions(view) {
  const data = await apiRequest("transactions.php");

  view.innerHTML = `
    ${panel("Record an expense", `
      <form id="expenseForm" class="form-grid">
        <label>Description
          <input id="expenseDescription" maxlength="255" required>
        </label>
        <label>Amount (KES)
          <input id="expenseAmount" type="number" min="0.01" step="0.01" required>
        </label>
        <label>Date
          <input id="expenseDate" type="date" required>
        </label>
        <button class="button" type="submit">Save expense</button>
      </form>
    `)}

    ${panel("Record a withdrawal", `
      <form id="withdrawalForm" class="form-grid">
        <label>Description
          <input id="withdrawalDescription" maxlength="255" required>
        </label>
        <label>Amount (KES)
          <input id="withdrawalAmount" type="number" min="0.01" step="0.01" required>
        </label>
        <button class="button" type="submit">Record withdrawal</button>
      </form>
    `)}

    ${panel("Transaction history", transactionTable(data.transactions || []))}
  `;

  $("expenseForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await apiRequest("expenses.php", {
        method: "POST",
        body: JSON.stringify({
          description: $("expenseDescription").value.trim(),
          amount: Number($("expenseAmount").value),
          spent_on: $("expenseDate").value
        })
      });
      message("Expense saved.");
      await navigate("transactions");
    } catch (error) {
      message(error.message, true);
    }
  });

  $("withdrawalForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await apiRequest("withdrawals.php", {
        method: "POST",
        body: JSON.stringify({
          description: $("withdrawalDescription").value.trim(),
          amount: Number($("withdrawalAmount").value)
        })
      });
      message("Withdrawal recorded.");
      await navigate("transactions");
    } catch (error) {
      message(error.message, true);
    }
  });
}

/* Budgets */

async function renderBudgets(view) {
  const data = await apiRequest("budgets.php");

  view.innerHTML = `
    ${panel("Create a budget", `
      <form id="budgetForm" class="form-grid">
        <label>Budget title
          <input id="budgetTitle" maxlength="100" required>
        </label>
        <label>Amount (KES)
          <input id="budgetAmount" type="number" min="0.01" step="0.01" required>
        </label>
        <button class="button" type="submit">Save budget</button>
      </form>
    `)}

    ${panel("Your budgets", (data.budgets || []).length
      ? data.budgets.map((item) => `
        <article class="goal-card">
          <h4>${escapeHTML(item.title)}</h4>
          <strong>${currency(item.amount)}</strong>
        </article>
      `).join("")
      : "<p>No budgets recorded yet.</p>")}
  `;

  $("budgetForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await apiRequest("budgets.php", {
        method: "POST",
        body: JSON.stringify({
          title: $("budgetTitle").value.trim(),
          amount: Number($("budgetAmount").value)
        })
      });
      message("Budget saved.");
      await navigate("budgets");
    } catch (error) {
      message(error.message, true);
    }
  });
}

/* Reports */

async function renderReports(view) {
  const data = await apiRequest("dashboard.php");
  const s = data.summary || {};

  view.innerHTML = panel("Financial summary", `
    <div class="report-list">
      <p>Total savings <strong>${currency(s.totalSavings)}</strong></p>
      <p>Savings target <strong>${currency(s.savingsTarget)}</strong></p>
      <p>Total expenses <strong>${currency(s.totalExpenses)}</strong></p>
      <p>Total withdrawals <strong>${currency(s.totalWithdrawals)}</strong></p>
      <p>Goal completion <strong>${progress(s.totalSavings, s.savingsTarget)}%</strong></p>
    </div>
  `);
}

/* Account settings */

function renderSettings(view) {
  view.innerHTML = panel("Your account", `
    <p><strong>Name:</strong> ${escapeHTML(state.user?.name)}</p>
    <p><strong>Email:</strong> ${escapeHTML(state.user?.email)}</p>
    <button class="button button-danger" id="logoutBtn" type="button">Log out</button>
  `);

  $("logoutBtn").addEventListener("click", logout);
}

async function logout() {
  if (state.busy) return;
  setBusy(true);

  try {
    await apiRequest("logout.php", { method: "POST" });

    state.user = null;
    $("loginForm").reset();
    $("regForm").reset();

    setAuthenticated(false);
    showTab(true);
    message("You have logged out.");
  } catch (error) {
    message(error.message, true);
  } finally {
    setBusy(false);
  }
}

$("logout").addEventListener("click", logout);

/* Start by checking the server-side session */

async function initialise() {
  setAuthenticated(false);
  showTab(true);

  try {
    const csrf = await apiRequest("csrf.php");

if (!csrf.csrfToken) {
  throw new Error("The server did not provide a CSRF token.");
}

state.csrfToken = csrf.csrfToken;
    const result = await apiRequest("me.php");

    if (result.user) {
      state.user = result.user;
      await openDashboard();
    }
  } catch {
    // Keep the login form visible when no valid session exists.
  }
}

initialise();
