const STORAGE_KEY = "quantum-scope-project-tracker-v4";
const LIVE_CHANNEL = "quantum-scope-project-tracker-live";
const SESSION_KEY = "quantum-scope-project-tracker-session-v1";
const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:3000" : "";

const seedState = {
  version: 4,
  updatedAt: null,
  projects: []
};

let state = loadState();
let currentUser = loadSession();
let currentRole = currentUser?.role ?? null;
let currentProjectId = state.projects[0]?.id ?? null;
let currentTeamId = null;
let currentProjectFormMode = "create";
const screenHistory = [];
const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel(LIVE_CHANNEL) : null;

const screens = document.querySelectorAll(".screen");
const backButton = document.getElementById("back-button");
const subtitle = document.getElementById("screen-subtitle");
const roleChip = document.getElementById("role-chip");
const logoutButton = document.getElementById("logout-button");
const loginRolePicker = document.getElementById("login-role-picker");
const loginFormPanel = document.getElementById("login-form-panel");
const loginRoleLabel = document.getElementById("login-role-label");
const loginManagerButton = document.getElementById("login-manager-button");
const loginMemberButton = document.getElementById("login-member-button");
const loginEmailInput = document.getElementById("login-email-input");
const loginPasswordInput = document.getElementById("login-password-input");
const loginButton = document.getElementById("login-button");
const loginFeedback = document.getElementById("login-feedback");
const enterManagerButton = document.getElementById("enter-manager-button");
const enterMemberButton = document.getElementById("enter-member-button");
const clearRoleButton = document.getElementById("clear-role-button");
const homeProjectTotal = document.getElementById("home-project-total");
const homeTeamTotal = document.getElementById("home-team-total");
const homeUpdateTotal = document.getElementById("home-update-total");
const projectGrid = document.getElementById("project-grid");
const selectedProjectCopy = document.getElementById("selected-project-copy");
const emptyStatePanel = document.getElementById("empty-state-panel");
const landingRoleStatus = document.getElementById("landing-role-status");
const managerProjectToolbar = document.getElementById("manager-project-toolbar");
const managerHomeTitle = document.getElementById("manager-home-title");
const managerLiveFeed = document.getElementById("manager-live-feed");
const managerPulseGrid = document.getElementById("manager-pulse-grid");
const managerRiskPanel = document.getElementById("manager-risk-panel");
const commandCenterCount = document.getElementById("command-center-count");
const removeProjectButton = document.getElementById("remove-project-button");
const editProjectButton = document.getElementById("edit-project-button");
const teamGrid = document.getElementById("team-grid");
const teamHomeTitle = document.getElementById("team-home-title");
const teamHomeProject = document.getElementById("team-home-project");
const teamTaskList = document.getElementById("team-task-list");
const teamStatusList = document.getElementById("team-status-list");
const teamDependencyList = document.getElementById("team-dependency-list");
const teamDependentList = document.getElementById("team-dependent-list");
const reportTypeSelect = document.getElementById("report-type-select");
const reportSeveritySelect = document.getElementById("report-severity-select");
const reportTaskSelect = document.getElementById("report-task-select");
const reportDelaySelect = document.getElementById("report-delay-select");
const reportTitleInput = document.getElementById("report-title-input");
const reportBodyInput = document.getElementById("report-body-input");
const teamNoteFeed = document.getElementById("team-note-feed");
const progressTitle = document.getElementById("progress-title");
const progressChip = document.getElementById("progress-chip");
const progressBarFill = document.getElementById("progress-bar-fill");
const progressPercentCopy = document.getElementById("progress-percent-copy");
const bugList = document.getElementById("bug-list");
const chartBars = document.getElementById("chart-bars");
const schedulerTitle = document.getElementById("scheduler-title");
const schedulerBody = document.getElementById("scheduler-body");
const schedulerLog = document.getElementById("scheduler-log");
const impactBoard = document.getElementById("impact-board");
const assistantFeed = document.getElementById("assistant-feed");
const assistantInput = document.getElementById("assistant-input");
const baseCodeInput = document.getElementById("base-code-input");
const teamCountDisplay = document.getElementById("team-count-display");
const employeeTeamSelect = document.getElementById("employee-team-select");
const employeeListInput = document.getElementById("employee-list-input");
const taskTeamSelect = document.getElementById("task-team-select");
const taskDependencySelect = document.getElementById("task-dependency-select");
const taskPrioritySelect = document.getElementById("task-priority-select");
const managerTaskList = document.getElementById("manager-task-list");
const taskTitleInput = document.getElementById("task-title-input");
const taskStartInput = document.getElementById("task-start-input");
const taskEndInput = document.getElementById("task-end-input");
const projectFormTitle = document.getElementById("project-form-title");
const projectFormMode = document.getElementById("project-form-mode");
const newProjectName = document.getElementById("new-project-name");
const newProjectDeadline = document.getElementById("new-project-deadline");
const newProjectTeamCount = document.getElementById("new-project-team-count");
const newProjectDescription = document.getElementById("new-project-description");
const newProjectCode = document.getElementById("new-project-code");
const createProjectButton = document.getElementById("create-project-button");
const updateProjectButton = document.getElementById("update-project-button");

init();

function init() {
  bindEvents();
  bindSyncEvents();
  refreshUi(false);
  showScreen(currentUser ? "project-list" : "login", false);
}

function bindEvents() {
  backButton.addEventListener("click", handleBack);
  loginButton.addEventListener("click", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  loginManagerButton.addEventListener("click", () => {
    currentRole = "manager";
    renderLogin();
    clearLoginFeedback();
  });
  loginMemberButton.addEventListener("click", () => {
    currentRole = "member";
    renderLogin();
    clearLoginFeedback();
  });
  loginEmailInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin();
    }
  });
  loginPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin();
    }
  });
  enterManagerButton.addEventListener("click", () => enterRole("manager"));
  enterMemberButton.addEventListener("click", () => enterRole("member"));
  clearRoleButton.addEventListener("click", clearRole);
  document.getElementById("empty-create-button").addEventListener("click", () => {
    enterRole("manager");
    openProjectForm("create");
  });
  document.getElementById("manager-create-project-button").addEventListener("click", () => openProjectForm("create"));
  editProjectButton.addEventListener("click", () => openProjectForm("edit"));
  removeProjectButton.addEventListener("click", removeCurrentProject);

  document.querySelectorAll(".role-card").forEach((button) => {
    button.addEventListener("click", () => {
      enterRole(button.dataset.role, false);
      if (button.dataset.role === "manager") {
        showScreen("manager-home");
      } else {
        showScreen("team-select");
      }
    });
  });

  document.querySelectorAll(".nav-card").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.target));
  });

  document.getElementById("submit-live-report").addEventListener("click", submitLiveReport);
  document.getElementById("assistant-send").addEventListener("click", handleAssistantAsk);
  assistantInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAssistantAsk();
    }
  });

  document.getElementById("save-base-code").addEventListener("click", saveBaseCode);
  document.getElementById("add-team-button").addEventListener("click", addTeam);
  document.getElementById("remove-team-button").addEventListener("click", removeTeam);
  document.getElementById("save-employee-list").addEventListener("click", saveEmployeeList);
  document.getElementById("create-task-button").addEventListener("click", createTask);
  document.getElementById("add-task-button").addEventListener("click", () => showScreen("team-management"));
  employeeTeamSelect.addEventListener("change", populateEmployeeEditor);
  createProjectButton.addEventListener("click", createProject);
  updateProjectButton.addEventListener("click", updateProject);
  reportTypeSelect.addEventListener("change", updateReportFormState);
}

function bindSyncEvents() {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    state = parseState(event.newValue);
    refreshUi(true);
  });

  if (syncChannel) {
    syncChannel.addEventListener("message", (event) => {
      if (event.data?.type !== "state-updated") return;
      state = loadState();
      refreshUi(true);
    });
  }
}

function enterRole(role, rerender = true) {
  currentRole = role;
  if (rerender) {
    refreshUi(false);
  }
}

function clearRole() {
  currentRole = null;
  refreshUi(false);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return clone(seedState);
  }

  return parseState(saved);
}

function loadSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved);
    return isValidEmail(parsed?.email) && isValidRole(parsed?.role) ? parsed : null;
  } catch (error) {
    console.warn("Could not parse saved session.", error);
    return null;
  }
}

function saveSession() {
  if (!currentUser) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function parseState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.projects)) {
      return clone(seedState);
    }

    return parsed;
  } catch (error) {
    console.warn("Could not parse saved state.", error);
    return clone(seedState);
  }
}

function saveState(reason = "Tracker updated") {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (syncChannel) {
    syncChannel.postMessage({
      type: "state-updated",
      reason,
      at: state.updatedAt
    });
  }
}

function refreshUi(fromSync) {
  ensureSelections();
  updateRoleChip();
  updateAuthUi();
  renderProjectList();

  const activeScreen = document.querySelector(".screen.active")?.dataset.screen ?? (currentUser ? "project-list" : "login");
  const nextScreen = normalizeScreen(activeScreen);

  if (fromSync) {
    showScreen(nextScreen, false);
  } else {
    hydrateScreen(nextScreen);
  }
}

function ensureSelections() {
  if (currentProjectId && !state.projects.some((project) => project.id === currentProjectId)) {
    currentProjectId = null;
  }

  if (!currentProjectId && state.projects.length) {
    currentProjectId = state.projects[0].id;
  }

  const project = getCurrentProject();
  if (currentTeamId && project && !project.teams.some((team) => team.id === currentTeamId)) {
    currentTeamId = null;
  }

  if (!project) {
    currentTeamId = null;
  }
}

function normalizeScreen(screenName) {
  if (!currentUser && screenName !== "login") {
    return "login";
  }

  if (currentUser && screenName === "login") {
    return "project-list";
  }

  const project = getCurrentProject();
  const managerScreens = new Set(["manager-home", "project-progress", "scheduler", "base-code", "team-management"]);
  const needsProject = new Set([
    "role-select",
    "manager-home",
    "team-select",
    "team-home",
    "project-progress",
    "scheduler",
    "assistant",
    "base-code",
    "team-management"
  ]);

  if (needsProject.has(screenName) && !project) {
    return currentRole === "manager" ? "new-project" : "project-list";
  }

  if (screenName === "new-project") {
    return currentRole === "manager" ? "new-project" : "project-list";
  }

  if (managerScreens.has(screenName) && currentRole !== "manager") {
    return project ? "role-select" : "project-list";
  }

  if ((screenName === "team-select" || screenName === "team-home") && currentRole !== "member") {
    return project ? "role-select" : "project-list";
  }

  if (screenName === "assistant" && !project) {
    return "project-list";
  }

  return screenName;
}

function showScreen(screenName, remember = true) {
  const normalized = normalizeScreen(screenName);
  const active = document.querySelector(".screen.active")?.dataset.screen;

  if (remember && active && active !== normalized) {
    screenHistory.push(active);
  }

  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === normalized);
  });

  backButton.classList.toggle("hidden", screenHistory.length === 0 || normalized === "login" || !currentUser);
  hydrateScreen(normalized);
}

function hydrateScreen(screenName) {
  subtitle.textContent = getSubtitle(screenName);

  if (screenName === "login") {
    renderLogin();
    return;
  }

  if (screenName === "project-list") {
    renderProjectList();
    return;
  }

  const project = getCurrentProject();

  if (screenName === "role-select") {
    selectedProjectCopy.textContent = project ? `Selected project: ${project.name}` : "Select a project first.";
    return;
  }

  if (screenName === "manager-home") {
    renderManagerHome(project);
    return;
  }

  if (screenName === "team-select") {
    renderTeamCards(project);
    return;
  }

  if (screenName === "team-home") {
    renderTeamHome(project);
    return;
  }

  if (screenName === "project-progress") {
    renderProgress(project);
    return;
  }

  if (screenName === "scheduler") {
    renderScheduler(project);
    return;
  }

  if (screenName === "assistant") {
    renderAssistant(project);
    return;
  }

  if (screenName === "base-code") {
    renderBaseCode(project);
    return;
  }

  if (screenName === "team-management") {
    renderTeamManagement(project);
    return;
  }

  if (screenName === "new-project") {
    renderProjectForm();
  }
}

function getSubtitle(screenName) {
  const project = getCurrentProject();
  const name = project?.name;

  const subtitles = {
    login: "Sign in with your email account to access the tracker.",
    "project-list": "Start with an empty tracker, then initiate real projects from scratch.",
    "role-select": name ? `Choose access for ${name}.` : "Choose access for the selected project.",
    "manager-home": "Integrated control for schedule shifts, issue pressure, and project decisions.",
    "team-select": "Pick the team workspace you belong to.",
    "team-home": "Log defects, issues, and schedule delays instantly with no wait state.",
    "project-progress": "Derived from live activity and issue data instead of mock charts.",
    "scheduler": "Schedule changes ripple through predecessor and successor activities immediately.",
    "assistant": "Local analysis answers questions from the real project state.",
    "base-code": "Store project approach notes and technical guidance inside the project itself.",
    "team-management": "Project managers control resource teams, assignments, dependencies, and activities.",
    "new-project": currentProjectFormMode === "edit" ? "Update the current project charter." : "Develop a new project charter."
  };

  return subtitles[screenName] ?? "Project tracker";
}

function handleBack() {
  const previous = screenHistory.pop();
  if (!previous) return;
  showScreen(previous, false);
}

function updateRoleChip() {
  if (!currentUser) {
    roleChip.textContent = "Access: sign in required";
    return;
  }

  if (!currentRole) {
    roleChip.textContent = `Signed in: ${currentUser.email}`;
    return;
  }

  roleChip.textContent = `${currentUser.email} • ${
    currentRole === "manager" ? "Project Manager / Leader" : "Team member"
  }`;
}

function updateAuthUi() {
  logoutButton.classList.toggle("hidden", !currentUser);
  if (!currentUser) {
    backButton.classList.add("hidden");
  }
}

function renderLogin() {
  loginManagerButton.classList.toggle("button-selected", currentRole === "manager");
  loginMemberButton.classList.toggle("button-selected", currentRole === "member");
  loginManagerButton.setAttribute("aria-pressed", String(currentRole === "manager"));
  loginMemberButton.setAttribute("aria-pressed", String(currentRole === "member"));
  loginRolePicker.classList.toggle("hidden", Boolean(currentRole));
  loginFormPanel.classList.toggle("hidden", !currentRole);
  loginRoleLabel.textContent = currentRole === "manager" ? "Project manager" : "Team member";

  if (!currentUser) {
    loginEmailInput.value = "";
    loginPasswordInput.value = "";
  }
  clearLoginFeedback();
}

async function handleLogin() {
  const email = loginEmailInput.value.trim().toLowerCase();
  const password = loginPasswordInput.value;

  if (!currentRole) {
    showLoginFeedback("Choose whether you are entering as project manager or team member.");
    return;
  }

  if (!isValidEmail(email)) {
    showLoginFeedback("Enter a valid email address.");
    return;
  }

  if (!password || password.length < 6) {
    showLoginFeedback("Enter a password with at least 6 characters.");
    return;
  }

  loginButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        role: currentRole
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      showLoginFeedback(payload.error || "Login failed.");
      return;
    }

    currentUser = {
      email: payload.user.email,
      role: payload.user.role,
      signedInAt: timestampIso()
    };
    currentRole = payload.user.role;
    saveSession();
    clearLoginFeedback();
    refreshUi(false);
    showScreen("project-list", false);
  } catch (error) {
    showLoginFeedback("Could not reach the local login server. Open the app through http://127.0.0.1:3000.");
  } finally {
    loginButton.disabled = false;
  }
}

function handleLogout() {
  currentUser = null;
  currentRole = null;
  currentTeamId = null;
  screenHistory.length = 0;
  clearSession();
  refreshUi(false);
  showScreen("login", false);
}

function showLoginFeedback(message) {
  loginFeedback.textContent = message;
  loginFeedback.classList.remove("hidden");
}

function clearLoginFeedback() {
  loginFeedback.textContent = "";
  loginFeedback.classList.add("hidden");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidRole(value) {
  return value === "manager" || value === "member";
}

function renderProjectList() {
  const hasProjects = state.projects.length > 0;
  const managerMode = currentRole === "manager";
  const memberMode = currentRole === "member";
  const teamTotal = state.projects.reduce((sum, project) => sum + project.teams.length, 0);
  const updateTotal = state.projects.reduce(
    (sum, project) => sum + project.incidents.length + (project.projectChanges?.length || 0),
    0
  );

  enterManagerButton.classList.toggle("button-selected", managerMode);
  enterMemberButton.classList.toggle("button-selected", memberMode);
  clearRoleButton.classList.toggle("button-selected", !currentRole);
  enterManagerButton.setAttribute("aria-pressed", String(managerMode));
  enterMemberButton.setAttribute("aria-pressed", String(memberMode));
  clearRoleButton.setAttribute("aria-pressed", String(!currentRole));
  homeProjectTotal.textContent = String(state.projects.length);
  homeTeamTotal.textContent = String(teamTotal);
  homeUpdateTotal.textContent = String(updateTotal);

  emptyStatePanel.classList.toggle("hidden", hasProjects);
  managerProjectToolbar.classList.toggle("hidden", !managerMode || !hasProjects);

  if (!currentRole) {
    landingRoleStatus.textContent = "Select a role first. Project managers can create the first project when the tracker is empty.";
  } else if (managerMode && !hasProjects) {
    landingRoleStatus.textContent = "Project manager mode is active. Create the first project charter to unlock the full tracker.";
  } else if (managerMode) {
    landingRoleStatus.textContent = "Project manager mode is active. Open a project or initiate another one.";
  } else if (!hasProjects) {
    landingRoleStatus.textContent = "Team member mode is active, but there are no projects yet. A project manager has to create one first.";
  } else {
    landingRoleStatus.textContent = "Team member mode is active. Pick a project to open your team workspace.";
  }

  projectGrid.innerHTML = "";

  if (!hasProjects) {
    return;
  }

  state.projects.forEach((project) => {
    const metrics = getProjectMetrics(project);
    const teamCount = project.teams.length;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "feature-card project-card";
    card.innerHTML = `
      <span class="project-card-topline">
        <span class="status-tag">${metrics.completion}% complete</span>
        <span class="project-card-arrow">Open</span>
      </span>
      <span class="feature-title">${project.name}</span>
      <span class="feature-copy">${project.description}</span>
      <span class="project-card-meta">${teamCount} teams</span>
      <span class="feature-copy">${metrics.openBugs} open defects • ${metrics.blockers} issues • ${metrics.delays} delays</span>
    `;
    card.addEventListener("click", () => {
      currentProjectId = project.id;
      currentTeamId = null;

      if (currentRole === "manager") {
        showScreen("manager-home");
      } else if (currentRole === "member") {
        showScreen("team-select");
      } else {
        showScreen("role-select");
      }
    });
    projectGrid.append(card);
  });
}

function renderManagerHome(project) {
  if (!project) return;

  managerHomeTitle.textContent = project.name;
  removeProjectButton.disabled = currentRole !== "manager";
  editProjectButton.disabled = currentRole !== "manager";

  const feed = getManagerFeed(project).slice(-10).reverse();
  commandCenterCount.textContent = `${feed.length} live updates`;
  managerLiveFeed.innerHTML = "";

  if (!feed.length) {
    managerLiveFeed.innerHTML = `<div class="note-entry"><span class="note-meta">No live updates</span><p>Delays, issues, and important project changes will appear here.</p></div>`;
  } else {
    feed.forEach((entry) => managerLiveFeed.append(buildFeedEntry(entry)));
  }

  renderPulseGrid(project);
  renderRiskPanel(project);
}

function renderPulseGrid(project) {
  managerPulseGrid.innerHTML = "";

  project.teams.forEach((team) => {
    const teamTasks = project.tasks.filter((task) => task.teamId === team.id);
    const incidents = project.incidents.filter(
      (incident) => incident.teamId === team.id && incident.status !== "resolved"
    );
    const pulseCard = document.createElement("div");
    pulseCard.className = "pulse-card";
    pulseCard.innerHTML = `
      <strong>${team.name}</strong>
      <span>${team.employees.length} resources • ${teamTasks.length} activities • ${incidents.length} active issue log entries</span>
    `;
    managerPulseGrid.append(pulseCard);
  });
}

function renderRiskPanel(project) {
  const risks = detectRisks(project);
  managerRiskPanel.innerHTML = "";

  if (!risks.length) {
    managerRiskPanel.innerHTML = `<li>No hidden schedule risks detected right now.</li>`;
    return;
  }

  risks.forEach((risk) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="severity-tag severity-${risk.severity}">${capitalize(risk.severity)}</span> ${risk.message}`;
    managerRiskPanel.append(li);
  });
}

function renderTeamCards(project) {
  if (!project) return;

  teamGrid.innerHTML = "";
  project.teams.forEach((team) => {
    const teamTasks = project.tasks.filter((task) => task.teamId === team.id);
    const openIncidents = project.incidents.filter(
      (incident) => incident.teamId === team.id && incident.status !== "resolved"
    );
    const card = document.createElement("button");
    card.type = "button";
    card.className = "feature-card team-card";
    card.innerHTML = `
      <span class="feature-title">${team.name}</span>
      <span class="feature-copy">Resources: ${team.employees.join(", ") || "No resources listed yet"}</span>
      <span class="feature-copy">${teamTasks.length} activities • ${openIncidents.length} active issue log entries</span>
    `;
    card.addEventListener("click", () => {
      currentTeamId = team.id;
      showScreen("team-home");
    });
    teamGrid.append(card);
  });
}

function renderTeamHome(project) {
  if (!project) return;
  const team = getCurrentTeam() ?? project.teams[0];
  if (!team) return;
  currentTeamId = team.id;

  teamHomeTitle.textContent = team.name;
  teamHomeProject.textContent = project.name;

  const teamTasks = project.tasks.filter((task) => task.teamId === team.id);
  fillList(
    teamTaskList,
    teamTasks.map(
      (task) =>
        `${task.title} • ${formatDateTime(task.start)} to ${formatDateTime(task.end)} • ${task.priority} priority`
    ),
    "No activities assigned yet."
  );
  fillList(
    teamStatusList,
    teamTasks.map((task) => `${task.title}: ${task.status}`),
    "No activity status updates yet."
  );
  fillList(teamDependencyList, team.dependsOn, "No predecessor team dependencies.");
  fillList(teamDependentList, team.dependedOnBy, "No successor team dependencies.");

  populateReportTaskSelect(project, team);
  renderTeamReports(project, team);
  updateReportFormState();
}

function populateReportTaskSelect(project, team) {
  const teamTasks = project.tasks.filter((task) => task.teamId === team.id);
  reportTaskSelect.innerHTML = `<option value="">Whole team / not tied to a single activity</option>`;

  teamTasks.forEach((task) => {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.title;
    reportTaskSelect.append(option);
  });
}

function renderTeamReports(project, team) {
  const reports = project.incidents
    .filter((incident) => incident.teamId === team.id && ["bug", "blocker", "delay"].includes(incident.type))
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  teamNoteFeed.innerHTML = "";

  if (!reports.length) {
    teamNoteFeed.innerHTML = `<div class="note-entry"><span class="note-meta">No delay or issue entries yet</span><p>Use the form to submit a defect, issue, or schedule delay.</p></div>`;
    return;
  }

  reports.forEach((report) => teamNoteFeed.append(buildFeedEntry(report)));
}

function renderProgress(project) {
  if (!project) return;

  const metrics = getProjectMetrics(project);
  progressTitle.textContent = project.name;
  progressChip.textContent = `${metrics.completion}% complete • target finish ${project.deadline || "not set"}`;
  progressBarFill.style.width = `${metrics.completion}%`;
  progressPercentCopy.textContent = `${metrics.completedTasks} of ${metrics.totalTasks} activities are completed. ${metrics.blockers} issues and ${metrics.delays} live schedule delays are active.`;

  const bugSummary = project.incidents
    .filter((incident) => ["bug", "blocker", "delay"].includes(incident.type))
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, 6)
    .map((incident) => `${formatEntryTypeLabel(incident.type)} • ${incident.title} • ${capitalize(incident.severity)}`);

  fillList(bugList, bugSummary, "No defects, issues, or schedule delays have been reported.");

  chartBars.innerHTML = "";
  const teamCompletion = project.teams.map((team) => {
    const teamTasks = project.tasks.filter((task) => task.teamId === team.id);
    if (!teamTasks.length) {
      return { label: team.name, value: 0 };
    }

    const complete = teamTasks.filter((task) => task.status === "Completed").length;
    return {
      label: team.name,
      value: Math.round((complete / teamTasks.length) * 100)
    };
  });

  const maxValue = Math.max(...teamCompletion.map((item) => item.value), 1);
  teamCompletion.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "chart-bar";
    wrapper.innerHTML = `
      <span class="chart-value">${item.value}%</span>
      <div class="chart-bar-fill" style="height: ${(item.value / maxValue) * 180 + 36}px;"></div>
      <span>${item.label}</span>
    `;
    chartBars.append(wrapper);
  });
}

function renderScheduler(project) {
  if (!project) return;
  schedulerTitle.textContent = project.name;
  schedulerBody.innerHTML = "";

  const dependencyOptions = buildDependencyOptions(project.tasks);
  const teamOptions = project.teams
    .map((team) => `<option value="${team.id}">${team.name}</option>`)
    .join("");

  sortTasksByStart(project.tasks).forEach((task) => {
    const row = document.createElement("tr");
    const dependsOn = task.dependencyIds?.[0] || "";
    row.innerHTML = `
      <td><input data-task-id="${task.id}" data-field="title" type="text" value="${escapeAttribute(task.title)}" /></td>
      <td>
        <select data-task-id="${task.id}" data-field="teamId">
          ${withSelected(teamOptions, task.teamId)}
        </select>
      </td>
      <td>
        <select data-task-id="${task.id}" data-field="dependencyId">
          ${buildSelectedDependencyOptions(dependencyOptions, task.id, dependsOn)}
        </select>
      </td>
      <td><input data-task-id="${task.id}" data-field="start" type="datetime-local" value="${task.start}" /></td>
      <td><input data-task-id="${task.id}" data-field="end" type="datetime-local" value="${task.end}" /></td>
      <td>
        <select data-task-id="${task.id}" data-field="priority">
          ${renderPriorityOptions(task.priority)}
        </select>
      </td>
      <td>
        <select data-task-id="${task.id}" data-field="status">
          ${renderStatusOptions(task.status)}
        </select>
      </td>
      <td>
        <div class="mini-actions">
          <button class="mini-button" data-delay-task="${task.id}" data-delay-minutes="60" type="button">Slip 1h</button>
          <button class="mini-button" data-delay-task="${task.id}" data-delay-minutes="240" type="button">Slip 4h</button>
          <button class="danger-button" data-remove-task="${task.id}" type="button">Delete</button>
        </div>
      </td>
    `;
    schedulerBody.append(row);
  });

  schedulerBody.querySelectorAll("input, select").forEach((input) => {
    toggleManagerOnly(input, true);
    input.addEventListener("change", handleTaskEdit);
  });

  schedulerBody.querySelectorAll("[data-delay-task]").forEach((button) => {
    button.disabled = currentRole !== "manager";
    button.addEventListener("click", () => {
      const liveProject = getCurrentProject();
      applyTaskDelay(liveProject, button.dataset.delayTask, Number(button.dataset.delayMinutes), {
        reporter: "Manager",
        title: "Manual schedule adjustment",
        details: "Project manager triggered a live schedule shift from the schedule board."
      });
      saveState("Manual schedule adjustment");
      refreshUi(false);
      showScreen("scheduler", false);
    });
  });

  schedulerBody.querySelectorAll("[data-remove-task]").forEach((button) => {
    button.disabled = currentRole !== "manager";
    button.addEventListener("click", () => removeTask(button.dataset.removeTask));
  });

  renderSchedulerLog(project);
  renderImpactBoard(project);
}

function renderSchedulerLog(project) {
  schedulerLog.innerHTML = "";
  const entries = [...project.schedulerLog].reverse();

  if (!entries.length) {
    schedulerLog.innerHTML = `<div class="note-entry"><span class="note-meta">No schedule events yet</span><p>Schedule changes and timing updates appear here.</p></div>`;
    return;
  }

  entries.forEach((entry) => schedulerLog.append(buildFeedEntry(entry)));
}

function renderImpactBoard(project) {
  impactBoard.innerHTML = "";
  const delays = project.incidents
    .filter((incident) => incident.type === "delay")
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, 6);

  if (!delays.length) {
    impactBoard.innerHTML = `<li>No schedule impact data yet. Once a delay is reported, affected activities show up here.</li>`;
    return;
  }

  delays.forEach((delay) => {
    const li = document.createElement("li");
    const count = delay.affectedTaskIds?.length ?? 0;
    li.innerHTML = `<span class="severity-tag severity-${delay.severity}">${capitalize(delay.severity)}</span> ${delay.title} shifted ${count} activit${count === 1 ? "y" : "ies"}.`;
    impactBoard.append(li);
  });
}

function renderAssistant(project) {
  if (!project) return;

  assistantFeed.innerHTML = "";
  project.assistantLog.forEach((item) => {
    assistantFeed.append(buildAssistantBubble(item.speaker, item.text, item.speaker === "You"));
  });
}

function renderBaseCode(project) {
  if (!project) return;
  baseCodeInput.value = project.baseCode || "";
  toggleManagerOnly(baseCodeInput, true);
  document.getElementById("save-base-code").disabled = currentRole !== "manager";
}

function renderTeamManagement(project) {
  if (!project) return;

  teamCountDisplay.textContent = `${project.teams.length} resource teams`;
  employeeTeamSelect.innerHTML = project.teams.map((team) => `<option value="${team.id}">${team.name}</option>`).join("");
  taskTeamSelect.innerHTML = employeeTeamSelect.innerHTML;
  taskDependencySelect.innerHTML = buildDependencyOptions(project.tasks);
  populateEmployeeEditor();
  renderManagerTaskList(project);

  const managerOnlyIds = [
    "employee-team-select",
    "employee-list-input",
    "task-team-select",
    "task-title-input",
    "task-dependency-select",
    "task-priority-select",
    "task-start-input",
    "task-end-input",
    "create-task-button",
    "save-employee-list",
    "add-team-button",
    "remove-team-button"
  ];

  managerOnlyIds.forEach((id) => toggleManagerOnly(document.getElementById(id), true));
}

function renderManagerTaskList(project) {
  managerTaskList.innerHTML = "";

  if (!project.tasks.length) {
    managerTaskList.innerHTML = `<li class="task-editor-item"><div class="task-editor-copy"><strong>No activities yet</strong><span>Create activities to make the project schedule live.</span></div></li>`;
    return;
  }

  sortTasksByStart(project.tasks).forEach((task) => {
    const dependency = task.dependencyIds?.[0]
      ? project.tasks.find((candidate) => candidate.id === task.dependencyIds[0])?.title
      : "No predecessor";
    const item = document.createElement("li");
    item.className = "task-editor-item";
    item.innerHTML = `
      <div class="task-editor-copy">
        <strong>${task.title}</strong>
        <span>${getTeamName(project, task.teamId)} • ${task.priority} • ${dependency}</span>
      </div>
      <button class="danger-button" data-remove-task="${task.id}" type="button">Delete</button>
    `;
    item.querySelector("[data-remove-task]").disabled = currentRole !== "manager";
    item.querySelector("[data-remove-task]").addEventListener("click", () => removeTask(task.id));
    managerTaskList.append(item);
  });
}

function renderProjectForm() {
  const project = getCurrentProject();
  const isEdit = currentProjectFormMode === "edit" && currentRole === "manager" && project;

  projectFormTitle.textContent = isEdit ? `Update Project Charter: ${project.name}` : "Develop Project Charter";
  projectFormMode.textContent = isEdit ? "Charter update workflow" : "Initiation workflow";
  createProjectButton.classList.toggle("hidden", isEdit);
  updateProjectButton.classList.toggle("hidden", !isEdit);

  if (isEdit) {
    newProjectName.value = project.name;
    newProjectDeadline.value = project.deadline || "";
    newProjectTeamCount.value = project.teams.length;
    newProjectTeamCount.disabled = true;
    newProjectDescription.value = project.description || "";
    newProjectCode.value = project.baseCode || "";
  } else {
    newProjectName.value = "";
    newProjectDeadline.value = "";
    newProjectTeamCount.value = "2";
    newProjectTeamCount.disabled = false;
    newProjectDescription.value = "";
    newProjectCode.value = "";
  }
}

function openProjectForm(mode) {
  if (mode === "edit" && currentRole !== "manager") {
    return;
  }

  currentProjectFormMode = mode;
  showScreen("new-project");
}

function createProject() {
  if (currentRole !== "manager") return;

  const name = newProjectName.value.trim();
  const description = newProjectDescription.value.trim();
  const deadline = newProjectDeadline.value;
  const baseCode = newProjectCode.value;
  const teamCount = clampNumber(Number(newProjectTeamCount.value || 2), 1, 12);

  if (!name || !description || !deadline) {
    alert("Add a project title, project scope statement, and target completion date.");
    return;
  }

  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: buildId("team"),
    name: `Team ${index + 1}`,
    employees: [],
    dependsOn: index === 0 ? ["Project Management Team"] : [`Team ${index}`],
    dependedOnBy: index < teamCount - 1 ? [`Team ${index + 2}`] : [],
    notes: []
  }));

  const project = {
    id: buildId("project"),
    name,
    description,
    deadline,
    baseCode,
    createdAt: timestampIso(),
    updatedAt: timestampIso(),
    teams,
    tasks: [],
    incidents: [],
    projectChanges: [
      {
        id: buildId("project-change"),
        type: "project",
        severity: "low",
        title: "Project created",
        details: "The project charter was created and the dashboard is ready for setup.",
        createdAt: timestampIso(),
        status: "active"
      }
    ],
    schedulerLog: [
      {
        id: buildId("log"),
        type: "scheduler",
        severity: "low",
        title: "Project charter created",
        details: "The project schedule is ready for activity creation.",
        createdAt: timestampIso(),
        status: "active"
      }
    ],
    assistantLog: [
      {
        speaker: "Helper",
        text: "Project charter created. Ask about risks, schedule, issues, or which team needs attention."
      }
    ]
  };

  state.projects.push(project);
  currentProjectId = project.id;
  currentTeamId = project.teams[0]?.id ?? null;
  saveState("Project charter created");
  refreshUi(false);
  showScreen("manager-home");
}

function updateProject() {
  if (currentRole !== "manager") return;
  const project = getCurrentProject();
  if (!project) return;

  const name = newProjectName.value.trim();
  const description = newProjectDescription.value.trim();
  const deadline = newProjectDeadline.value;

  if (!name || !description || !deadline) {
    alert("Add a project title, project scope statement, and target completion date.");
    return;
  }

  project.name = name;
  project.description = description;
  project.deadline = deadline;
  project.baseCode = newProjectCode.value;
  project.updatedAt = timestampIso();
  recordProjectChange(project, "Project updated", "The project charter details were updated by the project manager.");
  saveState("Project charter updated");
  refreshUi(false);
  showScreen("manager-home");
}

function removeCurrentProject() {
  if (currentRole !== "manager") return;
  const project = getCurrentProject();
  if (!project) return;

  if (!window.confirm(`Remove "${project.name}" from the project register?`)) {
    return;
  }

  state.projects = state.projects.filter((entry) => entry.id !== project.id);
  currentProjectId = state.projects[0]?.id ?? null;
  currentTeamId = null;
  screenHistory.length = 0;
  saveState("Project removed");
  refreshUi(false);
  showScreen("project-list", false);
}

function addTeam() {
  const project = getCurrentProject();
  if (!project || currentRole !== "manager") return;

  const nextIndex = project.teams.length + 1;
  project.teams.push({
    id: buildId("team"),
    name: `Team ${nextIndex}`,
    employees: [],
    dependsOn: nextIndex === 1 ? ["Project Management Team"] : [`Team ${nextIndex - 1}`],
    dependedOnBy: [],
    notes: []
  });

  project.updatedAt = timestampIso();
  recordProjectChange(project, "Team added", `${project.teams[project.teams.length - 1].name} was added to the project.`);
  saveState("Team added");
  refreshUi(false);
  showScreen("team-management", false);
}

function removeTeam() {
  const project = getCurrentProject();
  if (!project || currentRole !== "manager") return;

  if (project.teams.length <= 1) {
    alert("At least one resource team is required inside a project.");
    return;
  }

  const removedTeam = project.teams.pop();
  project.tasks = project.tasks.filter((task) => task.teamId !== removedTeam.id);
  project.incidents = project.incidents.filter((incident) => incident.teamId !== removedTeam.id);
  project.tasks.forEach((task) => {
    task.dependencyIds = (task.dependencyIds || []).filter((id) => project.tasks.some((candidate) => candidate.id === id));
  });

  project.updatedAt = timestampIso();
  recordProjectChange(project, "Team removed", `${removedTeam.name} was removed from the project.`);
  saveState("Team removed");
  refreshUi(false);
  showScreen("team-management", false);
}

function populateEmployeeEditor() {
  const project = getCurrentProject();
  const team = project?.teams.find((entry) => entry.id === employeeTeamSelect.value);
  employeeListInput.value = team ? team.employees.join("\n") : "";
}

function saveEmployeeList() {
  const project = getCurrentProject();
  if (!project || currentRole !== "manager") return;

  const team = project.teams.find((entry) => entry.id === employeeTeamSelect.value);
  if (!team) return;

  team.employees = employeeListInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  recordProjectChange(
    project,
    "Assignments updated",
    `${team.name} now has ${team.employees.length} listed resource${team.employees.length === 1 ? "" : "s"}.`
  );
  saveState("Resource assignments updated");
  refreshUi(false);
  showScreen("manager-home", false);
}

function createTask() {
  const project = getCurrentProject();
  if (!project || currentRole !== "manager") return;

  const title = taskTitleInput.value.trim();
  const teamId = taskTeamSelect.value;
  const dependencyId = taskDependencySelect.value;
  const priority = taskPrioritySelect.value;
  const start = taskStartInput.value;
  const end = taskEndInput.value;

  if (!title || !teamId || !start || !end) {
    alert("Fill in the resource team, activity name, planned start, and planned finish.");
    return;
  }

  const task = {
    id: buildId("task"),
    title,
    teamId,
    start,
    end,
    priority,
    status: "Planned",
    dependencyIds: dependencyId ? [dependencyId] : [],
    delayMinutes: 0
  };

  normalizeTask(task);
  project.tasks.push(task);
  rebalanceProjectSchedule(project);
  recordProjectChange(project, "Activity created", `${task.title} was added to the project schedule.`);

  clearTaskForm();
  saveState("Activity created");
  refreshUi(false);
  showScreen("team-management", false);
}

function clearTaskForm() {
  taskTitleInput.value = "";
  taskStartInput.value = "";
  taskEndInput.value = "";
  taskDependencySelect.value = "";
  taskPrioritySelect.value = "Medium";
}

function handleTaskEdit(event) {
  const project = getCurrentProject();
  if (!project || currentRole !== "manager") return;

  const task = project.tasks.find((entry) => entry.id === event.target.dataset.taskId);
  if (!task) return;

  const field = event.target.dataset.field;
  if (field === "dependencyId") {
    task.dependencyIds = event.target.value ? [event.target.value] : [];
  } else {
    task[field] = event.target.value;
  }

  normalizeTask(task);
  rebalanceProjectSchedule(project);
  saveState("Activity updated");
  refreshUi(false);
  showScreen("scheduler", false);
}

function removeTask(taskId) {
  const project = getCurrentProject();
  if (!project || currentRole !== "manager") return;

  const task = project.tasks.find((entry) => entry.id === taskId);
  project.tasks = project.tasks.filter((entry) => entry.id !== taskId);
  project.tasks.forEach((entry) => {
    entry.dependencyIds = (entry.dependencyIds || []).filter((id) => id !== taskId);
  });
  project.incidents = project.incidents.filter((incident) => incident.taskId !== taskId || incident.type !== "delay");
  recordProjectChange(project, "Activity removed", `${task?.title || "An activity"} was removed from the project schedule.`, "medium");

  saveState("Activity removed");
  refreshUi(false);
}

function submitLiveReport() {
  const project = getCurrentProject();
  const team = getCurrentTeam();
  if (!project || !team) return;

  const type = reportTypeSelect.value;
  const severity = reportSeveritySelect.value;
  const taskId = reportTaskSelect.value || null;
  const delayMinutes = Number(reportDelaySelect.value || 0);
  const title = reportTitleInput.value.trim() || `${formatEntryTypeLabel(type)} reported`;
  const details = reportBodyInput.value.trim();

  if (!details) {
    alert("Write the issue description before submitting the log entry.");
    return;
  }

  const incident = {
    id: buildId("incident"),
    type,
    severity,
    teamId: team.id,
    taskId,
    title,
    details,
    reporter: currentRole === "manager" ? "Project Manager" : team.name,
    createdAt: timestampIso(),
    status: type === "update" ? "active" : "active",
    affectedTaskIds: []
  };

  project.incidents.push(incident);

  if (type === "bug") {
    const task = project.tasks.find((entry) => entry.id === taskId);
    if (task && task.status === "Planned") {
      task.status = "In progress";
    }
  }

  if (type === "blocker") {
    const task = project.tasks.find((entry) => entry.id === taskId);
    if (task) {
      task.status = "Blocked";
    }
  }

  if (type === "delay") {
    const result = taskId
      ? applyTaskDelay(project, taskId, delayMinutes || 60, {
          reporter: incident.reporter,
          title,
          details,
          severity
        })
      : applyTeamDelay(project, team.id, delayMinutes || 60, {
          reporter: incident.reporter,
          title,
          details,
          severity
        });

    incident.affectedTaskIds = result.affectedTaskIds;
    incident.details = `${details} ${result.message}`.trim();
  }

  saveState("Issue log entry submitted");
  clearReportForm();
  refreshUi(false);
  showScreen("team-home", false);
}

function clearReportForm() {
  reportTypeSelect.value = "blocker";
  reportSeveritySelect.value = "medium";
  reportTaskSelect.value = "";
  reportDelaySelect.value = "0";
  reportTitleInput.value = "";
  reportBodyInput.value = "";
  updateReportFormState();
}

function updateReportFormState() {
  const isDelay = reportTypeSelect.value === "delay";
  reportDelaySelect.disabled = !isDelay;
}

function applyTeamDelay(project, teamId, minutes, meta) {
  const candidate = sortTasksByStart(project.tasks).find(
    (task) => task.teamId === teamId && task.status !== "Completed"
  );

  if (!candidate) {
    project.schedulerLog.push({
      id: buildId("log"),
      type: "scheduler",
      severity: meta.severity || "low",
      title: "Delay reported with no scheduled activity",
      details: `${getTeamName(project, teamId)} reported a delay, but no active activity was scheduled.`,
      createdAt: timestampIso(),
      status: "active"
    });
    return {
      affectedTaskIds: [],
      message: "No active scheduled activity existed for that team."
    };
  }

  return applyTaskDelay(project, candidate.id, minutes, meta);
}

function applyTaskDelay(project, taskId, minutes, meta) {
  const rootTask = project.tasks.find((task) => task.id === taskId);
  if (!rootTask) {
    return { affectedTaskIds: [], message: "No matching activity was found for the delay." };
  }

  const impactedIds = collectImpactedTaskIds(project, rootTask);
  impactedIds.forEach((id) => {
    const task = project.tasks.find((entry) => entry.id === id);
    if (!task || task.status === "Completed") return;
    task.start = shiftDateTime(task.start, minutes);
    task.end = shiftDateTime(task.end, minutes);
    task.delayMinutes = (task.delayMinutes || 0) + minutes;
    task.status = task.status === "Blocked" ? "Blocked" : "Delayed";
  });

  rebalanceProjectSchedule(project);

  const message = `${formatDelay(minutes)} applied to ${rootTask.title}. ${impactedIds.length} activit${impactedIds.length === 1 ? "y" : "ies"} moved.`;
  project.schedulerLog.push({
    id: buildId("log"),
    type: "delay",
    severity: meta.severity || "medium",
    title: meta.title || "Delay applied",
    details: `${message} ${meta.details || ""}`.trim(),
    createdAt: timestampIso(),
    status: "active",
    affectedTaskIds: impactedIds
  });

  return {
    affectedTaskIds: impactedIds,
    message
  };
}

function collectImpactedTaskIds(project, rootTask) {
  const impacted = new Set([rootTask.id]);
  const queue = [rootTask.id];

  sortTasksByStart(project.tasks)
    .filter((task) => task.teamId === rootTask.teamId && new Date(task.start) >= new Date(rootTask.start))
    .forEach((task) => impacted.add(task.id));

  while (queue.length) {
    const current = queue.shift();
    project.tasks.forEach((task) => {
      if ((task.dependencyIds || []).includes(current) && !impacted.has(task.id)) {
        impacted.add(task.id);
        queue.push(task.id);
      }
    });
  }

  return sortTasksByStart(project.tasks)
    .filter((task) => impacted.has(task.id) && task.status !== "Completed")
    .map((task) => task.id);
}

function rebalanceProjectSchedule(project) {
  const sorted = sortTasksByStart(project.tasks);
  const lastEndByTeam = new Map();

  sorted.forEach((task) => {
    normalizeTask(task);

    const dependencyEnd = (task.dependencyIds || [])
      .map((id) => project.tasks.find((candidate) => candidate.id === id))
      .filter(Boolean)
      .reduce((latest, dependency) => {
        const depEnd = new Date(dependency.end).getTime();
        return Math.max(latest, depEnd);
      }, 0);

    if (dependencyEnd && new Date(task.start).getTime() < dependencyEnd) {
      const minutes = diffMinutes(task.start, new Date(dependencyEnd).toISOString());
      task.start = shiftDateTime(task.start, minutes);
      task.end = shiftDateTime(task.end, minutes);
    }

    const teamLastEnd = lastEndByTeam.get(task.teamId);
    if (teamLastEnd && new Date(task.start).getTime() < teamLastEnd) {
      const minutes = Math.ceil((teamLastEnd - new Date(task.start).getTime()) / 60000);
      task.start = shiftDateTime(task.start, minutes);
      task.end = shiftDateTime(task.end, minutes);
    }

    lastEndByTeam.set(task.teamId, new Date(task.end).getTime());
  });
}

function normalizeTask(task) {
  if (!task.start) {
    task.start = toLocalInputValue(new Date());
  }

  if (!task.end) {
    task.end = shiftDateTime(task.start, 60);
  }

  if (new Date(task.end).getTime() <= new Date(task.start).getTime()) {
    task.end = shiftDateTime(task.start, 60);
  }

  if (!task.status) {
    task.status = "Planned";
  }
}

function saveBaseCode() {
  const project = getCurrentProject();
  if (!project || currentRole !== "manager") return;

  project.baseCode = baseCodeInput.value;
  recordProjectChange(project, "Project approach updated", "The project approach and implementation notes were updated.");
  saveState("Base code updated");
  refreshUi(false);
  showScreen("manager-home", false);
}

function handleAssistantAsk() {
  const project = getCurrentProject();
  const question = assistantInput.value.trim();
  if (!project || !question) return;

  project.assistantLog.push({ speaker: "You", text: question });
  project.assistantLog.push({ speaker: "Helper", text: answerLocally(project, question) });
  assistantInput.value = "";
  saveState("Helper asked");
  refreshUi(false);
  showScreen("assistant", false);
}

function answerLocally(project, question) {
  const normalized = question.toLowerCase();
  const metrics = getProjectMetrics(project);
  const risks = detectRisks(project);
  const delays = project.incidents.filter((incident) => incident.type === "delay");
  const blockers = project.incidents.filter((incident) => incident.type === "blocker" && incident.status !== "resolved");
  const bugs = project.incidents.filter((incident) => incident.type === "bug" && incident.status !== "resolved");

  if (normalized.includes("risk")) {
    if (!risks.length) return "No hidden schedule risk is active right now.";
    return risks.slice(0, 3).map((risk) => risk.message).join(" ");
  }

  if (normalized.includes("delay")) {
    if (!delays.length) return "No delays have been reported yet.";
    return delays
      .slice(-3)
      .reverse()
      .map((delay) => `${delay.title}: ${delay.affectedTaskIds?.length || 0} activity shifts.`)
      .join(" ");
  }

  if (normalized.includes("blocker")) {
    if (!blockers.length) return "No issues are active.";
    return `${blockers.length} issue${blockers.length === 1 ? "" : "s"} active. The highest pressure is on ${findMostPressuredTeam(project)}.`;
  }

  if (normalized.includes("bug")) {
    return bugs.length ? `${bugs.length} open defect${bugs.length === 1 ? "" : "s"} are active.` : "No open defects are active.";
  }

  if (normalized.includes("critical path") || normalized.includes("critical")) {
    const criticalTasks = sortTasksByStart(project.tasks)
      .filter((task) => task.priority === "Critical" || (task.dependencyIds || []).length > 0)
      .slice(0, 3)
      .map((task) => `${task.title} (${formatDateTime(task.start)} to ${formatDateTime(task.end)})`);
    return criticalTasks.length ? `Current critical path candidates: ${criticalTasks.join(", ")}.` : "No critical path activities are defined yet.";
  }

  if (normalized.includes("team")) {
    return project.teams
      .map((team) => `${team.name}: ${team.employees.length} resources, ${project.tasks.filter((task) => task.teamId === team.id).length} activities.`)
      .join(" ");
  }

  if (normalized.includes("progress") || normalized.includes("complete")) {
    return `${project.name} is ${metrics.completion}% complete with ${metrics.completedTasks} completed activities out of ${metrics.totalTasks}.`;
  }

  return `Project summary: ${metrics.completion}% complete, ${metrics.openBugs} open defects, ${metrics.blockers} open issues, and ${metrics.delays} live schedule delays. Ask me about risk, issues, defects, delays, teams, or critical path.`;
}

function getCurrentProject() {
  return state.projects.find((project) => project.id === currentProjectId) ?? null;
}

function getCurrentTeam() {
  const project = getCurrentProject();
  return project?.teams.find((team) => team.id === currentTeamId) ?? null;
}

function getProjectMetrics(project) {
  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter((task) => task.status === "Completed").length;
  const completion = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const openBugs = project.incidents.filter((incident) => incident.type === "bug" && incident.status !== "resolved").length;
  const blockers = project.incidents.filter((incident) => incident.type === "blocker" && incident.status !== "resolved").length;
  const delays = project.incidents.filter((incident) => incident.type === "delay" && incident.status !== "resolved").length;

  return { totalTasks, completedTasks, completion, openBugs, blockers, delays };
}

function detectRisks(project) {
  const now = Date.now();
  const risks = [];

  sortTasksByStart(project.tasks).forEach((task) => {
    const taskStart = new Date(task.start).getTime();
    const taskEnd = new Date(task.end).getTime();

    if (task.status !== "Completed" && taskEnd < now) {
      risks.push({
        severity: "high",
        message: `${task.title} is already past its end time.`
      });
    }

    if (task.status === "Blocked") {
      risks.push({
        severity: "critical",
        message: `${task.title} is blocked and needs intervention.`
      });
    }

    const dependencyIssue = (task.dependencyIds || []).some((dependencyId) => {
      const dependency = project.tasks.find((candidate) => candidate.id === dependencyId);
      return dependency && dependency.status !== "Completed" && taskStart - now < 12 * 60 * 60 * 1000;
    });

    if (dependencyIssue) {
      risks.push({
        severity: "medium",
        message: `${task.title} starts soon but its dependency is not complete.`
      });
    }
  });

  const criticalIncidents = project.incidents.filter(
    (incident) => incident.severity === "critical" && incident.status !== "resolved"
  );
  criticalIncidents.forEach((incident) => {
    risks.push({
      severity: "critical",
      message: `${incident.title} is marked critical by ${incident.reporter}.`
    });
  });

  return risks.slice(0, 8);
}

function getLiveFeed(project) {
  const incidentFeed = project.incidents.map((incident) => ({
    ...incident,
    message: `${formatEntryTypeLabel(incident.type)} • ${incident.title}`
  }));
  const schedulerFeed = project.schedulerLog.map((entry) => ({
    ...entry,
    message: `${formatEntryTypeLabel(entry.type)} • ${entry.title}`
  }));

  return [...incidentFeed, ...schedulerFeed].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
}

function getManagerFeed(project) {
  const issueFeed = project.incidents.filter((incident) => ["bug", "blocker", "delay"].includes(incident.type));
  const projectChangeFeed = project.projectChanges || [];

  return [...issueFeed, ...projectChangeFeed].sort(
    (left, right) => new Date(left.createdAt) - new Date(right.createdAt)
  );
}

function recordProjectChange(project, title, details, severity = "low") {
  if (!project.projectChanges) {
    project.projectChanges = [];
  }

  project.projectChanges.push({
    id: buildId("project-change"),
    type: "project",
    severity,
    title,
    details,
    createdAt: timestampIso(),
    status: "active"
  });
}

function buildFeedEntry(entry) {
  const wrapper = document.createElement("div");
  wrapper.className = "note-entry";
  wrapper.innerHTML = `
    <span class="note-meta">${formatFeedType(entry)} • ${formatTimestamp(entry.createdAt)}</span>
    <p><span class="severity-tag severity-${entry.severity || "low"}">${capitalize(entry.severity || "low")}</span> ${entry.title}</p>
    <p>${entry.details || entry.message || ""}</p>
  `;
  return wrapper;
}

function formatFeedType(entry) {
  return formatEntryTypeLabel(entry.type || "update");
}

function fillList(container, items, emptyMessage) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<li>${emptyMessage}</li>`;
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.append(li);
  });
}

function toggleManagerOnly(element, disableWhenNotManager) {
  if (!element) return;
  element.disabled = disableWhenNotManager && currentRole !== "manager";
}

function renderPriorityOptions(currentPriority) {
  return ["Low", "Medium", "High", "Critical"]
    .map((priority) => `<option value="${priority}" ${priority === currentPriority ? "selected" : ""}>${priority}</option>`)
    .join("");
}

function renderStatusOptions(currentStatus) {
  return ["Planned", "In progress", "Blocked", "Delayed", "Completed"]
    .map((status) => `<option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>`)
    .join("");
}

function buildDependencyOptions(tasks) {
  return [
    `<option value="">No predecessor</option>`,
    ...sortTasksByStart(tasks).map((task) => `<option value="${task.id}">${task.title}</option>`)
  ].join("");
}

function formatEntryTypeLabel(type) {
  const labels = {
    update: "Update",
    bug: "Defect",
    blocker: "Issue",
    delay: "Schedule Delay",
    scheduler: "Schedule Change",
    project: "Project Change"
  };

  return labels[type] || capitalize(type || "update");
}

function buildSelectedDependencyOptions(baseOptions, currentTaskId, selectedDependencyId) {
  const options = baseOptions
    .replace(new RegExp(` value="${escapeRegExp(currentTaskId)}">`, "g"), ` value="${currentTaskId}" disabled>`)
    .replace(new RegExp(`value="${escapeRegExp(selectedDependencyId)}"`), `value="${selectedDependencyId}" selected`);

  return options;
}

function withSelected(optionsMarkup, selectedValue) {
  return optionsMarkup.replace(
    new RegExp(`value="${escapeRegExp(selectedValue)}"`),
    `value="${selectedValue}" selected`
  );
}

function buildAssistantBubble(speaker, text, isUser = false) {
  const template = document.getElementById("assistant-message-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.toggle("user", isUser);
  node.querySelector(".assistant-speaker").textContent = speaker;
  node.querySelector("p").textContent = text;
  return node;
}

function getTeamName(project, teamId) {
  return project.teams.find((team) => team.id === teamId)?.name ?? "Unknown team";
}

function findMostPressuredTeam(project) {
  let winner = "no team";
  let max = -1;

  project.teams.forEach((team) => {
    const pressure = project.incidents.filter(
      (incident) => incident.teamId === team.id && ["bug", "blocker", "delay"].includes(incident.type) && incident.status !== "resolved"
    ).length;
    if (pressure > max) {
      max = pressure;
      winner = team.name;
    }
  });

  return winner;
}

function sortTasksByStart(tasks) {
  return [...tasks].sort((left, right) => new Date(left.start) - new Date(right.start));
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function shiftDateTime(value, minutes) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return toLocalInputValue(date);
}

function toLocalInputValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function formatDelay(minutes) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${minutes} minutes`;
}

function diffMinutes(leftValue, rightValue) {
  return Math.ceil((new Date(rightValue).getTime() - new Date(leftValue).getTime()) / 60000);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, "&quot;");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function timestampIso() {
  return new Date().toISOString();
}
