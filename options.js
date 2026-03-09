const STORAGE_KEYS = {
  GROUPS: "ytChannelGroups",
  CHANNEL_TAGS: "ytChannelTags",
  API_KEY: "ytApiKey"
};

function getSync(keys) {
  return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}

function setSync(items) {
  return new Promise((resolve) => chrome.storage.sync.set(items, resolve));
}

function getLocal(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setLocal(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function randomColor() {
  const colors = ["#ff5252", "#ff9800", "#ffc107", "#4caf50", "#03a9f4", "#3f51b5", "#9c27b0"];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function loadState() {
  const [{ [STORAGE_KEYS.GROUPS]: groups = {}, [STORAGE_KEYS.CHANNEL_TAGS]: channelTags = {} }, { [STORAGE_KEYS.API_KEY]: apiKey = "" }] =
    await Promise.all([
      getSync([STORAGE_KEYS.GROUPS, STORAGE_KEYS.CHANNEL_TAGS]),
      getLocal([STORAGE_KEYS.API_KEY])
    ]);

  return { groups, channelTags, apiKey };
}

async function render() {
  const { groups, apiKey } = await loadState();

  const apiKeyInput = document.getElementById("apiKey");
  const apiStatus = document.getElementById("apiStatus");
  const groupsList = document.getElementById("groupsList");

  apiKeyInput.value = apiKey || "";
  apiStatus.textContent = "";

  groupsList.innerHTML = "";
  const groupArray = Object.values(groups);
  if (groupArray.length === 0) {
    groupsList.textContent = "No groups yet.";
  } else {
    groupArray.forEach((g) => {
      const row = document.createElement("div");
      row.className = "group-row";
      row.innerHTML = `
        <div class="group-color" style="background:${g.color}"></div>
        <input class="group-name-input" type="text" value="${g.name}" />
        <button class="btn-muted" data-action="save">Save</button>
        <button class="btn-muted danger" data-action="delete">Delete</button>
      `;

      const nameInput = row.querySelector(".group-name-input");
      const saveBtn = row.querySelector('[data-action="save"]');
      const delBtn = row.querySelector('[data-action="delete"]');

      saveBtn.addEventListener("click", async () => {
        const newName = nameInput.value.trim();
        if (!newName) return;

        const state = await loadState();
        if (!state.groups[g.id]) return;
        state.groups[g.id].name = newName;
        await setSync({ [STORAGE_KEYS.GROUPS]: state.groups });
        groupsStatus("Saved group name.");
      });

      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete group "${g.name}"? This will unassign it from all channels.`)) {
          return;
        }
        const state = await loadState();
        if (state.groups[g.id]) {
          delete state.groups[g.id];
        }
        for (const [cid, tags] of Object.entries(state.channelTags)) {
          state.channelTags[cid] = tags.filter((tid) => tid !== g.id);
          if (state.channelTags[cid].length === 0) {
            delete state.channelTags[cid];
          }
        }
        await setSync({
          [STORAGE_KEYS.GROUPS]: state.groups,
          [STORAGE_KEYS.CHANNEL_TAGS]: state.channelTags
        });
        groupsStatus("Deleted group.");
        render();
      });

      groupsList.appendChild(row);
    });
  }
}

function groupsStatus(msg) {
  const el = document.getElementById("groupsStatus");
  el.textContent = msg;
  if (msg) {
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 2000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const apiKeyInput = document.getElementById("apiKey");
  const apiStatus = document.getElementById("apiStatus");
  const addGroupBtn = document.getElementById("addGroupBtn");
  const newGroupName = document.getElementById("newGroupName");

  saveApiKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    await setLocal({ [STORAGE_KEYS.API_KEY]: key });
    apiStatus.textContent = key ? "API key saved." : "Cleared API key.";
    setTimeout(() => {
      if (apiStatus.textContent) apiStatus.textContent = "";
    }, 2000);
  });

  addGroupBtn.addEventListener("click", async () => {
    const name = newGroupName.value.trim();
    if (!name) return;
    const id = "grp_" + Date.now().toString(36);
    const color = randomColor();
    const state = await loadState();
    state.groups[id] = { id, name, color };
    await setSync({ [STORAGE_KEYS.GROUPS]: state.groups });
    newGroupName.value = "";
    groupsStatus("Added group.");
    render();
  });

  const clearAssignmentsBtn = document.getElementById("clearAssignmentsBtn");
  const clearAllDataBtn = document.getElementById("clearAllDataBtn");

  clearAssignmentsBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to remove all channels from their groups? Your group categories (Music, Sports, etc.) will stay.")) {
      return;
    }
    await chrome.storage.sync.remove([STORAGE_KEYS.CHANNEL_TAGS, STORAGE_KEYS.CHANNEL_META]);
    alert("All channel assignments have been cleared.");
    render();
  });

  clearAllDataBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to erase ALL data? This includes your groups, assignments, and API key.")) {
      return;
    }
    await Promise.all([
      chrome.storage.sync.clear(),
      chrome.storage.local.clear()
    ]);
    alert("All data has been cleared.");
    render();
  });

  render();
});

