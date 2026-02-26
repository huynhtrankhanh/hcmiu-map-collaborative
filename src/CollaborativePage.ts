import h from "hyperscript";
import sodium from "libsodium-wrappers-sumo";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

const jsonFetch = async (path: string, options: RequestInit = {}, token?: string) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
};

const splitCsv = (value: string) => value.split(",").map((x) => x.trim()).filter(Boolean);

const hashClientPassword = async (password: string, saltBase64: string) => {
  await sodium.ready;
  const salt = sodium.from_base64(saltBase64, sodium.base64_variants.ORIGINAL);
  const derived = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
    "uint8array"
  ) as Uint8Array;
  return sodium.to_base64(derived, sodium.base64_variants.ORIGINAL);
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type CollaborativePageOptions = {
  focusedEntityId?: string;
  focusedEntityLabel?: string;
};

export const CollaborativePage = (onExit?: () => void, options?: CollaborativePageOptions) => {
  const root = h("div");
  let token = "";
  let me: { id: string; username: string } | null = null;
  let entities: any[] = [];
  let trials: any[] = [];
  let notifications: any[] = [];
  let activityItems: any[] = [];
  let ws: WebSocket | null = null;
  let searchOutput = "";
  let currentSubPage: "hub" | "auth" | "entities" | "trials" | "research" | "notifications" | "activity" | "tutorial" = options?.focusedEntityId ? "entities" : "hub";

  const refresh = async () => {
    const [entitiesResult, trialsResult, activityResult] = await Promise.all([
      jsonFetch("/api/entities"),
      jsonFetch("/api/trials"),
      jsonFetch("/api/activity?limit=50"),
    ]);
    entities = entitiesResult.entities;
    trials = trialsResult.trials;
    activityItems = activityResult.items;
    if (token) {
      const notifResult = await jsonFetch("/api/notifications", {}, token);
      notifications = notifResult.notifications;
    }
  };

  const connectWebSocket = () => {
    if (!token) return;
    ws?.close();
    const protocol = API_BASE.startsWith("https") ? "wss" : "ws";
    const host = API_BASE.replace(/^https?:\/\//, "");
    ws = new WebSocket(`${protocol}://${host}/ws?token=${encodeURIComponent(token)}`);
    ws.onmessage = async () => {
      await refresh();
      render();
    };
  };

  const createCommentTag = (entity: any, trial?: any) => {
    if (!trial || !me) return "";
    if (entity.createdBy === trial.plaintiffUserId) return "[plaintiff]";
    if (entity.createdBy === trial.defendantUserId) return "[defendant]";
    if (trial.agreedJudges?.includes(entity.createdBy)) return "[judge]";
    return "[spectator]";
  };

  /* ---- Entity search helper for reference input ---- */
  const buildEntitySearchWidget = (panel: HTMLElement, inputId: string, selectedIdsContainerId: string) => {
    const searchInput = panel.querySelector(`#${inputId}`) as HTMLInputElement | null;
    const resultsContainer = panel.querySelector(`#${inputId}-results`) as HTMLElement | null;
    const selectedContainer = panel.querySelector(`#${selectedIdsContainerId}`) as HTMLElement | null;
    const expertInput = panel.querySelector(`#${inputId}-expert`) as HTMLInputElement | null;
    if (!searchInput || !resultsContainer || !selectedContainer) return { getSelectedIds: () => [] as string[] };

    const selectedIds: string[] = [];

    const renderSelected = () => {
      selectedContainer.innerHTML = "";
      if (selectedIds.length === 0) {
        selectedContainer.innerHTML = `<span class="text-xs text-gray-500">No references selected.</span>`;
        return;
      }
      for (const id of selectedIds) {
        const entity = entities.find((e) => e.id === id);
        const label = entity ? escapeHtml(entity.title || entity.id) : escapeHtml(id);
        const tag = document.createElement("span");
        tag.className = "inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1 mb-1";
        tag.innerHTML = `${label} <button data-remove-ref="${escapeHtml(id)}" class="text-red-500 font-bold ml-1">&times;</button>`;
        selectedContainer.appendChild(tag);
      }
      selectedContainer.querySelectorAll("[data-remove-ref]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const removeId = (btn as HTMLElement).dataset.removeRef!;
          const idx = selectedIds.indexOf(removeId);
          if (idx >= 0) selectedIds.splice(idx, 1);
          renderSelected();
        });
      });
    };
    renderSelected();

    searchInput.addEventListener("input", async () => {
      const q = searchInput.value.trim();
      if (q.length < 2) { resultsContainer.innerHTML = ""; return; }
      try {
        const result = await jsonFetch(`/api/research/fulltext?q=${encodeURIComponent(q)}`);
        resultsContainer.innerHTML = "";
        for (const entity of (result.entities || []).slice(0, 8)) {
          const item = document.createElement("div");
          item.className = "border-b p-1 cursor-pointer hover:bg-blue-50 text-sm";
          item.textContent = `${entity.title || "(untitled)"} [${entity.type}] — ${entity.id}`;
          item.addEventListener("click", () => {
            if (!selectedIds.includes(entity.id)) {
              selectedIds.push(entity.id);
              renderSelected();
            }
            resultsContainer.innerHTML = "";
            searchInput.value = "";
          });
          resultsContainer.appendChild(item);
        }
      } catch {}
    });

    if (expertInput) {
      const expertBtn = panel.querySelector(`#${inputId}-expert-add`) as HTMLElement | null;
      expertBtn?.addEventListener("click", () => {
        const ids = splitCsv(expertInput.value);
        for (const id of ids) {
          if (!selectedIds.includes(id)) selectedIds.push(id);
        }
        expertInput.value = "";
        renderSelected();
      });
    }

    return { getSelectedIds: () => [...selectedIds] };
  };

  /* ---- Entity picker for single entity (degree of separation, etc.) ---- */
  const buildSingleEntityPicker = (panel: HTMLElement, inputId: string) => {
    const searchInput = panel.querySelector(`#${inputId}`) as HTMLInputElement | null;
    const resultsContainer = panel.querySelector(`#${inputId}-results`) as HTMLElement | null;
    const selectedDisplay = panel.querySelector(`#${inputId}-selected`) as HTMLElement | null;
    const expertInput = panel.querySelector(`#${inputId}-expert`) as HTMLInputElement | null;
    if (!searchInput || !resultsContainer) return { getSelectedId: () => "" };

    let selectedId = "";

    const renderSelected = () => {
      if (!selectedDisplay) return;
      if (!selectedId) { selectedDisplay.innerHTML = `<span class="text-xs text-gray-500">None selected</span>`; return; }
      const entity = entities.find((e) => e.id === selectedId);
      const label = entity ? escapeHtml(entity.title || entity.id) : escapeHtml(selectedId);
      selectedDisplay.innerHTML = `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${label}</span>`;
    };
    renderSelected();

    searchInput.addEventListener("input", async () => {
      const q = searchInput.value.trim();
      if (q.length < 2) { resultsContainer.innerHTML = ""; return; }
      try {
        const result = await jsonFetch(`/api/research/fulltext?q=${encodeURIComponent(q)}`);
        resultsContainer.innerHTML = "";
        for (const entity of (result.entities || []).slice(0, 8)) {
          const item = document.createElement("div");
          item.className = "border-b p-1 cursor-pointer hover:bg-blue-50 text-sm";
          item.textContent = `${entity.title || "(untitled)"} [${entity.type}] — ${entity.id}`;
          item.addEventListener("click", () => {
            selectedId = entity.id;
            renderSelected();
            resultsContainer.innerHTML = "";
            searchInput.value = "";
          });
          resultsContainer.appendChild(item);
        }
      } catch {}
    });

    if (expertInput) {
      const expertBtn = panel.querySelector(`#${inputId}-expert-set`) as HTMLElement | null;
      expertBtn?.addEventListener("click", () => {
        selectedId = expertInput.value.trim();
        expertInput.value = "";
        renderSelected();
      });
    }

    return { getSelectedId: () => selectedId };
  };

  const render = () => {
    root.innerHTML = "";

    const container = h(
      "div.flex.flex-col.items-center.justify-center.min-h-screen",
      { style: "background:#F3F4F6" },
      h("div.bg-white.p-6.rounded-lg.shadow-md.w-full", { style: "max-width:72rem" })
    );
    const panel = container.querySelector("div")!;

    /* ---- Navigation bar ---- */
    const navItems = [
      { key: "hub", icon: "🏠", label: "Hub" },
      { key: "auth", icon: "🔐", label: "Auth" },
      { key: "entities", icon: "📡", label: "Entities" },
      { key: "trials", icon: "⚖️", label: "Trials" },
      { key: "research", icon: "🔎", label: "Research" },
      { key: "notifications", icon: "🔔", label: "Notifications" },
      { key: "activity", icon: "📰", label: "Activity" },
      { key: "tutorial", icon: "📖", label: "Tutorial" },
    ];
    const navHtml = navItems.map((item) => {
      const active = item.key === currentSubPage ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800";
      return `<button data-nav="${item.key}" class="${active} px-3 py-2 rounded text-sm font-semibold">${item.icon} ${item.label}</button>`;
    }).join("");

    let contentHtml = "";

    switch (currentSubPage) {
      case "hub": {
        contentHtml = `
          <h1 class="text-2xl font-semibold mb-3">🤝 HCMIU Collaborative</h1>
          <p class="mb-3 text-sm">Public read access is always available. Login is required to create content. Use the navigation above to access each feature.</p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div class="border rounded p-2 text-center"><div class="text-xs uppercase tracking-wide">Entities</div><div class="font-semibold">${entities.length}</div></div>
            <div class="border rounded p-2 text-center"><div class="text-xs uppercase tracking-wide">Trials</div><div class="font-semibold">${trials.length}</div></div>
            <div class="border rounded p-2 text-center"><div class="text-xs uppercase tracking-wide">Notifications</div><div class="font-semibold">${notifications.length}</div></div>
            <div class="border rounded p-2 text-center"><div class="text-xs uppercase tracking-wide">Mode</div><div class="font-semibold">${token ? "Authenticated" : "Public"}</div></div>
          </div>
          ${options?.focusedEntityId ? `<section class="border rounded p-3 mb-4 bg-green-50"><div class="font-semibold">Focused from map view</div><div class="text-sm">${escapeHtml(options.focusedEntityLabel || options.focusedEntityId)}</div><div class="text-xs text-gray-700">Entity ID: ${escapeHtml(options.focusedEntityId)}</div><button id="focused-research" class="bg-green-700 text-white px-3 py-1 rounded mt-2">Find all entities referencing this map entity</button></section>` : ""}
          <div class="grid md:grid-cols-2 gap-3">
            ${navItems.filter((n) => n.key !== "hub").map((n) => `<button data-nav="${n.key}" class="border rounded p-4 text-left hover:bg-blue-50"><span class="text-lg mr-2">${n.icon}</span><span class="font-semibold">${n.label}</span></button>`).join("")}
          </div>
        `;
        break;
      }
      case "auth": {
        contentHtml = `
          <h2 class="text-xl font-semibold mb-3">🔐 Authentication</h2>
          <div class="text-sm mb-3">${me ? `Logged in as <b>${escapeHtml(me.username)}</b>` : "Not logged in"}</div>
          <input id="username" class="border p-2 w-full mb-2" placeholder="Username" />
          <input id="password" type="password" class="border p-2 w-full mb-2" placeholder="Password" />
          <div class="flex gap-2">
            <button id="signup" class="bg-blue-600 text-white px-3 py-2 rounded w-full">Sign up</button>
            <button id="login" class="bg-blue-500 text-white px-3 py-2 rounded w-full">Log in</button>
          </div>
        `;
        break;
      }
      case "entities": {
        const entityMarkup = entities
          .filter((e) => e.type !== "comment")
          .map((entity) => {
            const comments = entities.filter((x) => x.parentEntityId === entity.id);
            const trial = trials.find((t) => t.entityId === entity.id);
            const mine = me?.id === entity.createdBy;
            const commentsMarkup = comments
              .map((comment) => `<li>${escapeHtml(createCommentTag(comment, trial))} ${escapeHtml(comment.body)}</li>`)
              .join("");
            return `
              <div class="border rounded p-3 mb-3">
                <div class="font-semibold">${escapeHtml(entity.title || "(untitled)")} <span class="text-xs text-gray-500">${escapeHtml(entity.type)}</span></div>
                <div class="text-sm">${escapeHtml(entity.body || "")}</div>
                <div class="text-xs text-gray-600">id: ${escapeHtml(entity.id)}</div>
                <div class="text-xs text-gray-600">refs: ${(entity.references || []).map((r: string) => escapeHtml(r)).join(", ") || "none"}</div>
                ${token ? `<div class="flex gap-2 flex-wrap mt-2"><button data-follow="${escapeHtml(entity.id)}" class="bg-blue-500 text-white px-2 py-1 rounded">Follow</button><button data-unfollow="${escapeHtml(entity.id)}" class="bg-gray-600 text-white px-2 py-1 rounded">Unfollow</button><button data-research-one="${escapeHtml(entity.id)}" class="bg-slate-700 text-white px-2 py-1 rounded">Find references</button>${mine ? `<button data-edit="${escapeHtml(entity.id)}" class="bg-yellow-600 text-white px-2 py-1 rounded">Edit</button><button data-delete="${escapeHtml(entity.id)}" class="bg-red-700 text-white px-2 py-1 rounded">Delete</button>` : ""}</div>` : ""}
                ${token ? `<div class="mt-2"><input data-comment-input="${escapeHtml(entity.id)}" class="border p-1 w-full" placeholder="Comment" /><button data-comment="${escapeHtml(entity.id)}" class="bg-green-600 text-white px-2 py-1 rounded mt-1">Comment</button></div>` : ""}
                <ul class="text-sm list-disc pl-5 mt-2">${commentsMarkup}</ul>
              </div>
            `;
          })
          .join("");

        contentHtml = `
          <h2 class="text-xl font-semibold mb-3">📡 Entities</h2>
          ${token ? `
          <section class="border rounded p-3 mb-4">
            <h3 class="font-semibold mb-2">📝 Create Entity</h3>
            <input id="entity-title" class="border p-2 w-full mb-2" placeholder="Title" />
            <textarea id="entity-body" class="border p-2 w-full mb-2" placeholder="Body"></textarea>
            <div class="mb-2">
              <label class="text-sm font-semibold">References (search to add):</label>
              <input id="ref-search" class="border p-2 w-full mb-1" placeholder="Search entities to reference..." />
              <div id="ref-search-results" class="max-h-40 overflow-auto"></div>
              <div id="ref-selected" class="mt-1 flex flex-wrap"></div>
              <details class="mt-1"><summary class="text-xs text-gray-500 cursor-pointer">Expert: Add by ID</summary>
                <div class="flex gap-1 mt-1"><input id="ref-search-expert" class="border p-1 flex-1 text-xs" placeholder="Entity IDs (comma-separated)" /><button id="ref-search-expert-add" class="bg-gray-500 text-white px-2 py-1 rounded text-xs">Add</button></div>
              </details>
            </div>
            <button id="create-entity" class="bg-green-600 text-white px-3 py-2 rounded w-full">Create</button>
          </section>
          ` : ""}
          ${entityMarkup || `<div class="text-sm text-gray-600">No entities yet.</div>`}
        `;
        break;
      }
      case "trials": {
        const trialMarkup = trials
          .map((trial) => {
            const historyHtml = (trial.judgeNegotiationHistory || []).map((entry: any) => {
              if (entry.acceptedBy) return `<div class="text-xs text-green-700">✅ Accepted by ${escapeHtml(entry.acceptedBy)} at ${escapeHtml(entry.timestamp)}</div>`;
              return `<div class="text-xs text-blue-700">📋 Proposed by ${escapeHtml(entry.proposedBy)} at ${escapeHtml(entry.timestamp)}: ${(entry.judges || []).map((j: string) => escapeHtml(j)).join(", ")}</div>`;
            }).join("");
            const lastProposalInfo = trial.lastProposedBy
              ? `<div class="text-xs text-orange-600 mt-1">Last proposal by: ${escapeHtml(trial.lastProposedBy)} — Judges: ${(trial.lastProposedJudges || []).map((j: string) => escapeHtml(j)).join(", ")}</div>`
              : "";
            const canAccept = (() => {
              if (!token || trial.status !== "pending_agreement") return false;
              if (!trial.lastProposedBy || !trial.lastProposedJudges?.length) return false;
              if (trial.lastProposedBy === me?.id) return false;
              return me?.id === trial.plaintiffUserId || me?.id === trial.defendantUserId;
            })();
            const canPropose = (() => {
              if (!token || trial.status !== "pending_agreement") return false;
              const isParticipant = me?.id === trial.plaintiffUserId || me?.id === trial.defendantUserId;
              if (!isParticipant) return false;
              return !trial.lastProposedBy || trial.lastProposedBy !== me?.id;
            })();
            const canVote = token && trial.status === "active" && trial.agreedJudges?.includes(me?.id);
            return `
              <div class="border rounded p-3 mb-3">
                <div class="font-semibold">Trial ${escapeHtml(trial.id)}</div>
                <div class="text-sm">status: ${escapeHtml(trial.status)}${trial.outcome ? `, outcome: ${escapeHtml(trial.outcome)}` : ""}</div>
                <div class="text-xs">agreed judges: ${(trial.agreedJudges || []).map((j: string) => escapeHtml(j)).join(", ") || "none"}</div>
                ${lastProposalInfo}
                ${historyHtml ? `<details class="mt-1"><summary class="text-xs cursor-pointer text-gray-500">Negotiation history</summary><div class="mt-1">${historyHtml}</div></details>` : ""}
                ${canAccept ? `<button data-accept-judges="${escapeHtml(trial.id)}" class="bg-green-600 text-white px-2 py-1 rounded mt-2">Accept Judges</button>` : ""}
                ${canPropose ? `<div class="mt-2"><input data-judges-input="${escapeHtml(trial.id)}" class="border p-1 w-full" placeholder="Judge usernames (comma-separated)" /><button data-judges="${escapeHtml(trial.id)}" class="bg-indigo-600 text-white px-2 py-1 rounded mt-1">${trial.lastProposedBy ? "Counter-propose Judges" : "Propose Judges"}</button></div>` : ""}
                ${canVote ? `<div class="mt-2"><select data-vote-input="${escapeHtml(trial.id)}" class="border p-1 w-full"><option value="plaintiff">plaintiff</option><option value="defendant">defendant</option><option value="no_winner">no_winner</option></select><button data-vote="${escapeHtml(trial.id)}" class="bg-purple-600 text-white px-2 py-1 rounded mt-1">Vote</button></div>` : ""}
                ${token ? `<div class="mt-2"><input data-trial-comment-input="${escapeHtml(trial.entityId)}" class="border p-1 w-full" placeholder="Trial comment" /><button data-trial-comment="${escapeHtml(trial.entityId)}" class="bg-green-700 text-white px-2 py-1 rounded mt-1">Comment on Trial</button></div>` : ""}
              </div>
            `;
          })
          .join("");

        contentHtml = `
          <h2 class="text-xl font-semibold mb-3">⚖️ Court of Justice</h2>
          ${token ? `
          <section class="border rounded p-3 mb-4">
            <h3 class="font-semibold mb-2">Create Trial</h3>
            <input id="trial-title" class="border p-2 w-full mb-2" placeholder="Trial title" />
            <input id="trial-defendant" class="border p-2 w-full mb-2" placeholder="Defendant username" />
            <textarea id="trial-description" class="border p-2 w-full mb-2" placeholder="Trial description"></textarea>
            <button id="create-trial" class="bg-amber-600 text-white px-3 py-2 rounded">Create Trial</button>
          </section>
          ` : ""}
          <p class="text-sm text-gray-600 mb-3">Judge agreement is an interactive dialogue: one party proposes judges, then the other can accept or counter-propose, and so on until agreement is reached.</p>
          ${trialMarkup || `<div class="text-sm text-gray-600">No trials yet.</div>`}
        `;
        break;
      }
      case "research": {
        contentHtml = `
          <h2 class="text-xl font-semibold mb-3">🔎 Deep Research</h2>
          <section class="border rounded p-3 mb-3">
            <h3 class="font-semibold mb-2">Find Referencing Entities</h3>
            <label class="text-sm">Search for entities to check references:</label>
            <input id="research-entity-search" class="border p-2 w-full mb-1" placeholder="Search entities..." />
            <div id="research-entity-search-results" class="max-h-40 overflow-auto"></div>
            <div id="research-refs-selected" class="mt-1 flex flex-wrap"></div>
            <details class="mt-1"><summary class="text-xs text-gray-500 cursor-pointer">Expert: Enter IDs directly</summary>
              <div class="flex gap-1 mt-1"><input id="research-entity-search-expert" class="border p-1 flex-1 text-xs" placeholder="Entity IDs (comma-separated)" /><button id="research-entity-search-expert-add" class="bg-gray-500 text-white px-2 py-1 rounded text-xs">Add</button></div>
            </details>
            <button id="research-by-refs" class="bg-slate-700 text-white px-3 py-2 rounded mt-2">Find Referencing Entities</button>
          </section>
          <section class="border rounded p-3 mb-3">
            <h3 class="font-semibold mb-2">Full-text Search</h3>
            <input id="research-fulltext" class="border p-2 w-full mb-2" placeholder="Full-text query" />
            <button id="research-fulltext-btn" class="bg-slate-700 text-white px-3 py-2 rounded">Full-text Search</button>
          </section>
          <section class="border rounded p-3 mb-3">
            <h3 class="font-semibold mb-2">Degree of Separation</h3>
            <div class="mb-2">
              <label class="text-sm">From entity (search):</label>
              <input id="degree-from-search" class="border p-2 w-full mb-1" placeholder="Search for source entity..." />
              <div id="degree-from-search-results" class="max-h-32 overflow-auto"></div>
              <div id="degree-from-search-selected" class="mt-1"></div>
              <details class="mt-1"><summary class="text-xs text-gray-500 cursor-pointer">Expert: Enter ID directly</summary>
                <div class="flex gap-1 mt-1"><input id="degree-from-search-expert" class="border p-1 flex-1 text-xs" placeholder="Entity ID" /><button id="degree-from-search-expert-set" class="bg-gray-500 text-white px-2 py-1 rounded text-xs">Set</button></div>
              </details>
            </div>
            <div class="mb-2">
              <label class="text-sm">To entity (search):</label>
              <input id="degree-to-search" class="border p-2 w-full mb-1" placeholder="Search for target entity..." />
              <div id="degree-to-search-results" class="max-h-32 overflow-auto"></div>
              <div id="degree-to-search-selected" class="mt-1"></div>
              <details class="mt-1"><summary class="text-xs text-gray-500 cursor-pointer">Expert: Enter ID directly</summary>
                <div class="flex gap-1 mt-1"><input id="degree-to-search-expert" class="border p-1 flex-1 text-xs" placeholder="Entity ID" /><button id="degree-to-search-expert-set" class="bg-gray-500 text-white px-2 py-1 rounded text-xs">Set</button></div>
              </details>
            </div>
            <button id="research-degree" class="bg-slate-700 text-white px-3 py-2 rounded">Find Degree of Separation</button>
          </section>
          <pre id="research-output" class="bg-gray-100 p-2 mt-2 overflow-auto text-xs">${escapeHtml(searchOutput || "No research query yet.")}</pre>
        `;
        break;
      }
      case "notifications": {
        const notificationMarkup = notifications
          .map((n) => `<li>${n.read ? "✅" : "🔔"} ${escapeHtml(n.message)} (${escapeHtml(n.entityId)})</li>`)
          .join("");
        contentHtml = `
          <h2 class="text-xl font-semibold mb-3">🔔 Notifications</h2>
          ${token ? "" : `<p class="text-sm text-gray-600 mb-3">Log in to see your notifications.</p>`}
          <ul class="list-disc pl-5 text-sm">${notificationMarkup || "<li>No notifications.</li>"}</ul>
        `;
        break;
      }
      case "activity": {
        const activityMarkup = activityItems.length > 0
          ? activityItems.map((item) => `
            <div class="border-b py-2">
              <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 rounded ${item.type === "comment" ? "bg-green-100 text-green-800" : item.type === "trial_update" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}">${escapeHtml(item.type)}</span>
                <span class="text-xs text-gray-500">${escapeHtml(item.createdAt)}</span>
              </div>
              <div class="text-sm font-semibold mt-1">${escapeHtml(item.title || "(untitled)")}</div>
              <div class="text-xs text-gray-600">${escapeHtml(item.body || "").slice(0, 200)}</div>
            </div>
          `).join("")
          : `<div class="text-sm text-gray-600">No recent activity.</div>`;
        contentHtml = `
          <h2 class="text-xl font-semibold mb-3">📰 Activity Feed</h2>
          <p class="text-sm text-gray-600 mb-3">Recent activity across all entities and trials.</p>
          ${activityMarkup}
        `;
        break;
      }
      case "tutorial": {
        contentHtml = `
          <h2 class="text-xl font-semibold mb-3">📖 How to Use HCMIU Collaborative</h2>
          <div class="prose max-w-none text-sm space-y-4">
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Step 1: Explore Without Logging In</h3>
              <p>You can browse all entities, trials, research results, and the activity feed without an account. Use the <b>Entities</b> page to see all posts and discussions, or the <b>Activity</b> page for a chronological feed.</p>
            </section>
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Step 2: Create an Account</h3>
              <p>Go to the <b>Auth</b> page. Enter a username and password, then click <b>Sign up</b>. Your password is securely hashed client-side before being sent to the server.</p>
            </section>
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Step 3: Create Content</h3>
              <p>Once logged in, go to the <b>Entities</b> page. Fill in a title and body, optionally search for other entities to reference, then click <b>Create</b>. You can also comment on existing entities.</p>
              <p>To add references, type in the search box to find entities. Click a result to add it. You can also use the <b>Expert</b> option to enter entity IDs directly.</p>
            </section>
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Step 4: Follow Entities</h3>
              <p>Click <b>Follow</b> on any entity to receive notifications when someone comments on it. Check the <b>Notifications</b> page for updates.</p>
            </section>
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Step 5: Court of Justice</h3>
              <p>Go to the <b>Trials</b> page to create a trial against another user. The judge agreement process is interactive:</p>
              <ol class="list-decimal pl-5">
                <li>The plaintiff proposes a set of judges.</li>
                <li>The defendant can <b>accept</b> the proposed judges or <b>counter-propose</b> a different set.</li>
                <li>If counter-proposed, the plaintiff can accept or counter-propose again.</li>
                <li>This back-and-forth continues until one party accepts the other's proposal.</li>
                <li>Once judges are agreed upon, they can vote on the trial outcome.</li>
              </ol>
            </section>
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Step 6: Deep Research</h3>
              <p>The <b>Research</b> page offers three powerful tools:</p>
              <ul class="list-disc pl-5">
                <li><b>Find Referencing Entities:</b> Search for entities that reference specific entities. Use the search box or enter IDs in expert mode.</li>
                <li><b>Full-text Search:</b> Search all entities by text content.</li>
                <li><b>Degree of Separation:</b> Find the shortest reference-path between two entities. Use search to select entities or enter IDs directly.</li>
              </ul>
            </section>
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Step 7: Map Integration</h3>
              <p>From the main landing page, use <b>View Map</b> to browse the campus. Click on a room or stairs to see its collaborative thread. Click <b>Open in HCMIU Collaborative</b> to jump directly into the discussion for that location.</p>
            </section>
            <section class="border rounded p-3">
              <h3 class="font-semibold mb-1">Tips</h3>
              <ul class="list-disc pl-5">
                <li>All changes are reflected in real-time via WebSocket — no need to refresh.</li>
                <li>Every room, stairs, user, and post is an entity that can be referenced and discussed.</li>
                <li>Use the activity feed to stay up to date with the latest community activity.</li>
              </ul>
            </section>
          </div>
        `;
        break;
      }
    }

    panel.innerHTML = `
      <button id="exit-btn" class="bg-red-500 text-white px-4 py-2 rounded w-full mb-3">Exit</button>
      <div class="flex flex-wrap gap-2 mb-4">${navHtml}</div>
      <div id="collab-content">${contentHtml}</div>
    `;
    root.appendChild(container);

    /* ---- Event wiring ---- */
    const byId = (id: string) => panel.querySelector(`#${id}`) as HTMLElement | null;
    const val = (id: string) => ((byId(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "").trim();

    // Navigation
    panel.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentSubPage = (btn as HTMLElement).dataset.nav as any;
        render();
      });
    });

    byId("exit-btn")?.addEventListener("click", () => onExit?.());

    // Auth
    byId("signup")?.addEventListener("click", async () => {
      try {
        const username = val("username");
        const password = val("password");
        const start = await jsonFetch("/api/auth/signup/start", { method: "POST", body: JSON.stringify({ username }) });
        const clientHash = await hashClientPassword(password, start.clientSalt);
        const finish = await jsonFetch("/api/auth/signup/finish", {
          method: "POST",
          body: JSON.stringify({ username, clientHash, clientSalt: start.clientSalt, serverSalt: start.serverSalt }),
        });
        token = finish.token;
        me = finish.user;
        connectWebSocket();
        await refresh();
        render();
      } catch (error: any) {
        alert(error.message);
      }
    });

    byId("login")?.addEventListener("click", async () => {
      try {
        const username = val("username");
        const password = val("password");
        const start = await jsonFetch("/api/auth/login/start", { method: "POST", body: JSON.stringify({ username }) });
        const clientHash = await hashClientPassword(password, start.clientSalt);
        const finish = await jsonFetch("/api/auth/login/finish", { method: "POST", body: JSON.stringify({ username, clientHash }) });
        token = finish.token;
        me = finish.user;
        connectWebSocket();
        await refresh();
        render();
      } catch (error: any) {
        alert(error.message);
      }
    });

    // Entity creation with search-based references
    let refSearchWidget: { getSelectedIds: () => string[] } | null = null;
    if (currentSubPage === "entities" && token) {
      refSearchWidget = buildEntitySearchWidget(panel, "ref-search", "ref-selected");
    }

    byId("create-entity")?.addEventListener("click", async () => {
      try {
        await jsonFetch(
          "/api/entities",
          {
            method: "POST",
            body: JSON.stringify({
              type: "post",
              title: val("entity-title"),
              body: val("entity-body"),
              references: refSearchWidget ? refSearchWidget.getSelectedIds() : [],
            }),
          },
          token
        );
        await refresh();
        render();
      } catch (error: any) {
        alert(error.message);
      }
    });

    // Trials
    byId("create-trial")?.addEventListener("click", async () => {
      try {
        await jsonFetch(
          "/api/trials",
          {
            method: "POST",
            body: JSON.stringify({
              title: val("trial-title"),
              description: val("trial-description"),
              defendantUsername: val("trial-defendant"),
            }),
          },
          token
        );
        await refresh();
        render();
      } catch (error: any) {
        alert(error.message);
      }
    });

    // Entity actions
    panel.querySelectorAll("[data-follow]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        try {
          await jsonFetch(`/api/entities/${(button as HTMLElement).dataset.follow}/follow`, { method: "POST" }, token);
          alert("Followed!");
        } catch (error: any) {
          alert(error.message);
        }
      });
    });
    panel.querySelectorAll("[data-unfollow]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        try {
          await jsonFetch(`/api/entities/${(button as HTMLElement).dataset.unfollow}/unfollow`, { method: "POST" }, token);
          alert("Unfollowed!");
        } catch (error: any) {
          alert(error.message);
        }
      });
    });
    panel.querySelectorAll("[data-research-one]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        try {
          const result = await jsonFetch(`/api/research/references?ids=${encodeURIComponent((button as HTMLElement).dataset.researchOne!)}`);
          searchOutput = JSON.stringify(result, null, 2);
          currentSubPage = "research";
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });
    panel.querySelectorAll("[data-edit]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        const entityId = (button as HTMLElement).dataset.edit!;
        const target = entities.find((x) => x.id === entityId);
        const nextBody = prompt("Edit entity body", target?.body ?? "");
        if (nextBody === null) return;
        try {
          await jsonFetch(`/api/entities/${entityId}`, { method: "PATCH", body: JSON.stringify({ body: nextBody }) }, token);
          await refresh();
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });
    panel.querySelectorAll("[data-delete]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        const entityId = (button as HTMLElement).dataset.delete!;
        if (!confirm("Delete this entity?")) return;
        try {
          await jsonFetch(`/api/entities/${entityId}`, { method: "DELETE" }, token);
          await refresh();
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });

    // Comments on entities
    panel.querySelectorAll("[data-comment]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        const entityId = (button as HTMLElement).dataset.comment!;
        const input = panel.querySelector(`[data-comment-input='${entityId}']`) as HTMLInputElement;
        try {
          await jsonFetch(
            "/api/entities",
            { method: "POST", body: JSON.stringify({ type: "comment", body: input.value, title: "", parentEntityId: entityId, references: [] }) },
            token
          );
          await refresh();
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });

    // Trial comments
    panel.querySelectorAll("[data-trial-comment]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        const entityId = (button as HTMLElement).dataset.trialComment!;
        const input = panel.querySelector(`[data-trial-comment-input='${entityId}']`) as HTMLInputElement;
        try {
          await jsonFetch(
            "/api/entities",
            { method: "POST", body: JSON.stringify({ type: "comment", body: input.value, title: "", parentEntityId: entityId, references: [] }) },
            token
          );
          await refresh();
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });

    // Judge propose / accept
    panel.querySelectorAll("[data-judges]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        const trialId = (button as HTMLElement).dataset.judges!;
        const input = panel.querySelector(`[data-judges-input='${trialId}']`) as HTMLInputElement;
        try {
          await jsonFetch(`/api/trials/${trialId}/propose-judges`, { method: "POST", body: JSON.stringify({ judges: splitCsv(input.value) }) }, token);
          await refresh();
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });

    panel.querySelectorAll("[data-accept-judges]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        const trialId = (button as HTMLElement).dataset.acceptJudges!;
        try {
          await jsonFetch(`/api/trials/${trialId}/accept-judges`, { method: "POST" }, token);
          await refresh();
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });

    // Vote
    panel.querySelectorAll("[data-vote]").forEach((button: Element) => {
      button.addEventListener("click", async () => {
        const trialId = (button as HTMLElement).dataset.vote!;
        const select = panel.querySelector(`[data-vote-input='${trialId}']`) as HTMLSelectElement;
        try {
          await jsonFetch(`/api/trials/${trialId}/vote`, { method: "POST", body: JSON.stringify({ vote: select.value }) }, token);
          await refresh();
          render();
        } catch (error: any) {
          alert(error.message);
        }
      });
    });

    // Research - entity search widgets
    if (currentSubPage === "research") {
      const refResearchWidget = buildEntitySearchWidget(panel, "research-entity-search", "research-refs-selected");
      const degreeFromWidget = buildSingleEntityPicker(panel, "degree-from-search");
      const degreeToWidget = buildSingleEntityPicker(panel, "degree-to-search");

      byId("research-by-refs")?.addEventListener("click", async () => {
        const ids = refResearchWidget.getSelectedIds();
        if (!ids.length) { alert("Select at least one entity"); return; }
        const result = await jsonFetch(`/api/research/references?ids=${encodeURIComponent(ids.join(","))}`);
        searchOutput = JSON.stringify(result, null, 2);
        render();
      });

      byId("research-fulltext-btn")?.addEventListener("click", async () => {
        const q = val("research-fulltext");
        const result = await jsonFetch(`/api/research/fulltext?q=${encodeURIComponent(q)}`);
        searchOutput = JSON.stringify(result, null, 2);
        render();
      });

      byId("research-degree")?.addEventListener("click", async () => {
        try {
          const from = degreeFromWidget.getSelectedId();
          const to = degreeToWidget.getSelectedId();
          if (!from || !to) { alert("Select both from and to entities"); return; }
          const result = await jsonFetch(`/api/research/degree?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
          searchOutput = JSON.stringify(result, null, 2);
        } catch (error: any) {
          searchOutput = error.message;
        }
        render();
      });
    }

    // Focused entity research
    byId("focused-research")?.addEventListener("click", async () => {
      try {
        const result = await jsonFetch(`/api/research/references?ids=${encodeURIComponent(options?.focusedEntityId ?? "")}`);
        searchOutput = JSON.stringify(result, null, 2);
        currentSubPage = "research";
      } catch (error: any) {
        searchOutput = error.message;
      }
      render();
    });
  };

  refresh()
    .then(async () => {
      if (options?.focusedEntityId) {
        const result = await jsonFetch(`/api/research/references?ids=${encodeURIComponent(options.focusedEntityId)}`);
        searchOutput = JSON.stringify(result, null, 2);
      }
    })
    .then(render);

  return {
    element: root,
    cleanup: () => ws?.close(),
  };
};
