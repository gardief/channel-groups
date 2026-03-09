// Storage keys
console.log("[YT Channel Grouper] content script loaded on", window.location.href);

const STORAGE_KEYS = {
  GROUPS: "ytChannelGroups",
  CHANNEL_TAGS: "ytChannelTags",
  CHANNEL_META: "ytChannelMeta"
};

// Helpers for Chrome storage
function getSync(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, resolve);
  });
}

function setSync(items) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(items, resolve);
  });
}

function getLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

// Basic in-page routing based on URL
function isChannelPage() {
  const path = window.location.pathname;
  return (
    path.startsWith("/channel/") ||
    path.startsWith("/@") ||
    path.startsWith("/c/")
  );
}

function isHomePage() {
  const path = window.location.pathname;
  // YouTube home is usually "/"
  return path === "/" || path === "/feed/subscriptions";
}

// Try to get a stable channelId from the DOM
// Try to get a stable channelId from the DOM
function getChannelIdFromDom() {
  // 1. Try metadata with internal ID (most stable)
  const metaId = document.querySelector('meta[itemprop="identifier"]') || 
                 document.querySelector('meta[itemprop="channelId"]');
  if (metaId && metaId.content) return metaId.content;

  // 2. Check canonical link which often contains /channel/UC...
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && canonical.href) {
    const m = canonical.href.match(/\/channel\/(UC[^/?#]+)/);
    if (m) return m[1];
  }

  // 3. Check itemprop URL
  const link = document.querySelector('link[itemprop="url"]');
  if (link && link.href) {
    const m = link.href.match(/\/channel\/(UC[^/?#]+)/);
    if (m) return m[1];
  }

  // 4. Fallback: normalize handle or path
  let path = window.location.pathname;
  if (!path || path === "/") return null; // Not a channel page ID
  
  // Strip trailing sub-pages like /videos, /shorts, /streams, /community
  // Handle /@username/anything -> /@username
  if (path.startsWith("/@")) {
    const parts = path.split("/");
    return parts[0] + "/" + parts[1]; // returns "/@username"
  }
  
  // Handle /channel/ID/anything -> ID
  if (path.startsWith("/channel/")) {
    const parts = path.split("/");
    return parts[2];
  }

  return path;
}

async function ensureDataStructures() {
  const {
    [STORAGE_KEYS.GROUPS]: groups = {},
    [STORAGE_KEYS.CHANNEL_TAGS]: channelTags = {},
    [STORAGE_KEYS.CHANNEL_META]: channelMeta = {}
  } = await getSync([
    STORAGE_KEYS.GROUPS,
    STORAGE_KEYS.CHANNEL_TAGS,
    STORAGE_KEYS.CHANNEL_META
  ]);

  return { groups, channelTags, channelMeta };
}

// ---------- Channel page UI (assign/unassign groups) ----------

let channelGroupButtonInjected = false;

async function injectChannelGroupButton() {
  if (!isChannelPage() || channelGroupButtonInjected) return;

  // Simple fixed-position button to avoid brittle YouTube DOM hooks
  const btn = document.createElement("button");
  btn.id = "ytcg-channel-group-button";
  btn.textContent = "Assign to groups";
  btn.addEventListener("click", () => {
    const channelId = getChannelIdFromDom();
    if (channelId) {
      openChannelGroupOverlay(channelId);
    } else {
      console.warn("[YT Channel Grouper] Could not find channel ID at click time.");
    }
  });
  document.body.appendChild(btn);

  channelGroupButtonInjected = true;
}

async function openChannelGroupOverlay(channelId) {
  const existing = document.getElementById("ytcg-overlay");
  if (existing) existing.remove();

  const data = await ensureDataStructures();
  const { groups, channelTags, channelMeta } = data;
  
  // Data migration/consolidation: find if this channel was tagged under a different ID variant
  let storageChanged = false;
  const currentPath = window.location.pathname;

  for (const [oldId, tags] of Object.entries(channelTags)) {
    if (oldId === channelId) continue;
    
    let isMatch = false;
    
    // 1. Match current URL path exactly (Legacy upgrade)
    if (oldId === currentPath || currentPath.startsWith(oldId + "/")) isMatch = true;

    // 2. Match handle root (/@name vs /@name/videos)
    if (!isMatch && oldId.startsWith("/@") && channelId.startsWith("/@")) {
      if (oldId.split("/")[1] === channelId.split("/")[1]) isMatch = true;
    }

    // 3. Match if one is a subpath of the other
    if (!isMatch && (oldId.startsWith(channelId + "/") || channelId.startsWith(oldId + "/"))) isMatch = true;

    if (isMatch) {
      console.log(`[YTCG] Migrating data from ${oldId} to ${channelId}`);
      channelTags[channelId] = [...new Set([...(channelTags[channelId] || []), ...tags])];
      delete channelTags[oldId];
      if (channelMeta[oldId]) {
        channelMeta[channelId] = { ...channelMeta[oldId], ...(channelMeta[channelId] || {}) };
        delete channelMeta[oldId];
      }
      storageChanged = true;
    }
  }

  if (storageChanged) {
    await setSync({
      [STORAGE_KEYS.CHANNEL_TAGS]: channelTags,
      [STORAGE_KEYS.CHANNEL_META]: channelMeta
    });
  }

  const currentGroups = channelTags[channelId] || [];
  const hasAnyGroup = currentGroups.length > 0;

  const overlay = document.createElement("div");
  overlay.id = "ytcg-overlay";
  overlay.innerHTML = `
    <div class="ytcg-overlay-backdrop"></div>
    <div class="ytcg-overlay-panel">
      <div class="ytcg-overlay-header">
        <h2>Groups for this channel</h2>
      </div>
      <div class="ytcg-overlay-body">
        <div class="ytcg-new-group">
          <input id="ytcg-new-group-name" type="text" placeholder="New group name (e.g. Music)" />
          <button id="ytcg-add-group-btn">Add group</button>
        </div>
        <div class="ytcg-groups-list">
          ${Object.values(groups).length === 0
            ? '<div class="ytcg-empty">No groups yet. Create one below.</div>'
            : Object.values(groups)
                .map(
                  (g) => `
            <label class="ytcg-group-item">
              <input type="checkbox" value="${g.id}" ${
                hasAnyGroup && currentGroups.includes(g.id) ? "checked" : ""
              } />
              <span class="ytcg-group-color" style="background:${g.color}"></span>
              <span class="ytcg-group-name">${g.name}</span>
            </label>
          `
                )
                .join("")}
        </div>
      </div>
      <div class="ytcg-overlay-footer">
        <button id="ytcg-cancel-btn">Close</button>
        <button id="ytcg-save-btn" class="ytcg-primary">Save groups</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".ytcg-overlay-backdrop").addEventListener("click", () =>
    overlay.remove()
  );
  overlay.querySelector("#ytcg-cancel-btn").addEventListener("click", () =>
    overlay.remove()
  );

  overlay.querySelector("#ytcg-save-btn").addEventListener("click", async () => {
    const checked = Array.from(
      overlay.querySelectorAll('.ytcg-group-item input[type="checkbox"]:checked')
    ).map((el) => el.value);

    const data = await ensureDataStructures();
    data.channelTags[channelId] = checked;

    // Store basic channel metadata to show in group views
    const metaName =
      document.querySelector("#text-container yt-formatted-string")?.textContent ||
      document.querySelector("#channel-name #text")?.textContent ||
      document.title.replace("- YouTube", "").trim();
    const metaUrl = window.location.href;
    data.channelMeta[channelId] = {
      id: channelId,
      name: metaName || channelId,
      url: metaUrl
    };

    await setSync({
      [STORAGE_KEYS.CHANNEL_TAGS]: data.channelTags,
      [STORAGE_KEYS.CHANNEL_META]: data.channelMeta
    });
    
    // Refresh sidebar immediately
    injectLeftMenuGroups();
    
    overlay.remove();
  });

  overlay.querySelector("#ytcg-add-group-btn").addEventListener("click", async () => {
    const input = overlay.querySelector("#ytcg-new-group-name");
    const name = input.value.trim();
    if (!name) return;

    const id = "grp_" + Date.now().toString(36);
    const color = randomColor();

    const data = await ensureDataStructures();
    
    // PERSIST current checkbox state before re-opening, so selections aren't lost 
    const currentSelections = Array.from(
      overlay.querySelectorAll('.ytcg-group-item input[type="checkbox"]:checked')
    ).map((el) => el.value);
    
    data.groups[id] = { id, name, color };
    data.channelTags[channelId] = currentSelections;
    
    await setSync({ 
      [STORAGE_KEYS.GROUPS]: data.groups,
      [STORAGE_KEYS.CHANNEL_TAGS]: data.channelTags 
    });

    input.value = "";
    overlay.remove();
    openChannelGroupOverlay(channelId); // re-open to refresh list
    
    // Refresh sidebar immediately
    injectLeftMenuGroups();
  });
}

function randomColor() {
  const colors = ["#ff5252", "#ff9800", "#ffc107", "#4caf50", "#03a9f4", "#3f51b5", "#9c27b0"];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ---------- Home page state (current selected group) ----------

let homeUiInjected = false; // kept for compatibility, but we no longer inject a home section
let currentSelectedGroupId = null;

// (No separate home section any more; channel listing is rendered under Groups in the left menu.)

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- Left menu "Groups" section ----------

let leftMenuGroupsInjected = false;

async function injectLeftMenuGroups() {
  // Try desktop left guide container
  const guide =
    document.querySelector("#guide-inner-content") ||
    document.querySelector("ytd-guide-renderer #sections") ||
    document.querySelector("#contentContainer");

  if (!guide) {
    return;
  }

  let section = document.getElementById("ytcg-groups-section");
  if (!section) {
    section = document.createElement("div");
    section.id = "ytcg-groups-section";
    section.className = "ytcg-groups-guide-section";
    section.innerHTML = `
      <div class="ytcg-groups-guide-header">Groups</div>
      <div class="ytcg-groups-guide-new">
        <input
          id="ytcg-groups-guide-new-input"
          type="text"
          placeholder="New group (e.g. Music)"
        />
        <button id="ytcg-groups-guide-add-btn">+</button>
      </div>
      <div id="ytcg-groups-guide-list" class="ytcg-groups-guide-list"></div>
    `;
    guide.appendChild(section);
    leftMenuGroupsInjected = true;
  }

  await renderLeftMenuGroups();
}

async function renderLeftMenuGroups() {
  const listEl = document.getElementById("ytcg-groups-guide-list");
  const inputEl = document.getElementById("ytcg-groups-guide-new-input");
  const addBtn = document.getElementById("ytcg-groups-guide-add-btn");

  if (!listEl || !inputEl || !addBtn) return;

  const { groups } = await ensureDataStructures();
  const groupList = Object.values(groups);

  if (groupList.length === 0) {
    listEl.innerHTML = `<div class="ytcg-groups-guide-empty">No groups yet.</div>`;
  } else {
    listEl.innerHTML = groupList
      .map(
        (g) => `
        <div class="ytcg-groups-guide-item" data-id="${g.id}">
          <div class="ytcg-groups-guide-row">
            <button class="ytcg-groups-guide-name ${
              g.id === currentSelectedGroupId ? "ytcg-groups-guide-name-active" : ""
            }">
              <span class="ytcg-group-color" style="background:${g.color}"></span>
              <span class="ytcg-groups-guide-label">${escapeHtml(g.name)}</span>
            </button>
            <button class="ytcg-groups-guide-delete" title="Delete group">×</button>
          </div>
          <div class="ytcg-groups-guide-channels" id="ytcg-channels-${g.id}"></div>
        </div>
      `
      )
      .join("");
  }

  // Add group
  addBtn.onclick = async () => {
    const name = inputEl.value.trim();
    if (!name) return;
    const id = "grp_" + Date.now().toString(36);
    const color = randomColor();
    const data = await ensureDataStructures();
    data.groups[id] = { id, name, color };
    await setSync({ [STORAGE_KEYS.GROUPS]: data.groups });
    inputEl.value = "";
    await renderLeftMenuGroups();
  };

  // Click handlers on each item
  listEl.querySelectorAll(".ytcg-groups-guide-item").forEach((item) => {
    const gid = item.getAttribute("data-id");
    const nameBtn = item.querySelector(".ytcg-groups-guide-name");
    const delBtn = item.querySelector(".ytcg-groups-guide-delete");

    if (nameBtn) {
      nameBtn.onclick = async () => {
        currentSelectedGroupId = gid === currentSelectedGroupId ? null : gid;
        await renderLeftMenuGroups();
      };
    }

    if (delBtn) {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        const data = await ensureDataStructures();
        if (!data.groups[gid]) return;
        // Remove group
        delete data.groups[gid];
        // Also remove from any channels
        for (const [cid, tags] of Object.entries(data.channelTags)) {
          const filtered = tags.filter((t) => t !== gid);
          if (filtered.length === 0) {
            delete data.channelTags[cid];
          } else {
            data.channelTags[cid] = filtered;
          }
        }
        await setSync({
          [STORAGE_KEYS.GROUPS]: data.groups,
          [STORAGE_KEYS.CHANNEL_TAGS]: data.channelTags
        });
        if (currentSelectedGroupId === gid) currentSelectedGroupId = null;
        await renderLeftMenuGroups();
      };
    }
  });

  await renderLeftMenuChannelsForSelectedGroup();
}

async function renderLeftMenuChannelsForSelectedGroup() {
  if (!currentSelectedGroupId) return;

  const container = document.getElementById(`ytcg-channels-${currentSelectedGroupId}`);
  if (!container) return;

  const { groups, channelTags, channelMeta } = await ensureDataStructures();

  const group = groups[currentSelectedGroupId];
  if (!group) {
    container.innerHTML =
      '<div class="ytcg-groups-guide-empty">Selected group not found.</div>';
    return;
  }

  const channelIds = Object.entries(channelTags)
    .filter(([, tags]) => tags.includes(currentSelectedGroupId))
    .map(([cid]) => cid);

  if (channelIds.length === 0) {
    container.innerHTML = "";
    return;
  }

  const items = channelIds
    .map((cid) => {
      const meta = (channelMeta && channelMeta[cid]) || {};
      const name = meta.name || cid;
      const url =
        meta.url ||
        (cid.startsWith("/channel/") || cid.startsWith("/@") || cid.startsWith("/c/")
          ? `https://www.youtube.com${cid}`
          : `https://www.youtube.com/channel/${cid}`);

      return `
        <a class="ytcg-groups-guide-channel" href="${url}" target="_blank" rel="noopener noreferrer">
          <span class="ytcg-groups-guide-channel-name">${escapeHtml(name)}</span>
        </a>
      `;
    })
    .join("");

  container.innerHTML = `
    ${items}
  `;
}

// ---------- SPA navigation handling ----------

function onLocationChange() {
  try {
    console.log(
      "[YT Channel Grouper] onLocationChange path=",
      window.location.pathname,
      "isChannelPage=",
      isChannelPage(),
      "isHomePage=",
      isHomePage()
    );
    if (isChannelPage()) {
      injectChannelGroupButton();
    } else {
      // Ensure the button is not visible outside channel pages
      const btn = document.getElementById("ytcg-channel-group-button");
      if (btn) btn.remove();
      channelGroupButtonInjected = false;
    }
    injectLeftMenuGroups();
  } catch (e) {
    console.error("yt-channel-grouper error during navigation", e);
  }
}

// Initial load
onLocationChange();

// YouTube SPA navigation events
window.addEventListener("yt-navigate-finish", onLocationChange);
window.addEventListener("yt-navigate-start", () => {
  // reset per-page flags
  channelGroupButtonInjected = false;
});

// Fallback: periodically ensure button visibility matches current page type
setInterval(() => {
  try {
    if (isChannelPage()) {
      if (!channelGroupButtonInjected) {
        injectChannelGroupButton();
      }
    } else {
      const btn = document.getElementById("ytcg-channel-group-button");
      if (btn) btn.remove();
      channelGroupButtonInjected = false;
    }
  } catch (e) {
    // Avoid spamming console on interval errors
  }
}, 1000);

