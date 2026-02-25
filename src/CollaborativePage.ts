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
  let ws: WebSocket | null = null;
  let searchOutput = "";

  const refresh = async () => {
    const [entitiesResult, trialsResult] = await Promise.all([
      jsonFetch("/api/entities"),
      jsonFetch("/api/trials"),
    ]);
    entities = entitiesResult.entities;
    trials = trialsResult.trials;
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

  const render = () => {
    root.innerHTML = "";
    const entityMarkup = entities
      .map((entity) => {
        const comments = entities.filter((x) => x.parentEntityId === entity.id);
        const trial = trials.find((t) => t.entityId === entity.id);
        const mine = me?.id === entity.createdBy;
        const commentsMarkup = comments
          .map((comment) => `<li>${createCommentTag(comment, trial)} ${comment.body}</li>`)
          .join("");
        return `
          <div class="border rounded p-3 mb-3">
            <div class="font-semibold">${entity.title || "(untitled)"} <span class="text-xs text-gray-500">${entity.type}</span></div>
            <div class="text-sm">${entity.body || ""}</div>
            <div class="text-xs text-gray-600">id: ${entity.id}</div>
            <div class="text-xs text-gray-600">refs: ${(entity.references || []).join(", ") || "none"}</div>
            ${token ? `<div class="flex gap-2 flex-wrap mt-2"><button data-follow="${entity.id}" class="bg-blue-500 text-white px-2 py-1 rounded">Follow</button><button data-unfollow="${entity.id}" class="bg-gray-600 text-white px-2 py-1 rounded">Unfollow</button><button data-research-one="${entity.id}" class="bg-slate-700 text-white px-2 py-1 rounded">Find references</button>${mine ? `<button data-edit="${entity.id}" class="bg-yellow-600 text-white px-2 py-1 rounded">Edit</button><button data-delete="${entity.id}" class="bg-red-700 text-white px-2 py-1 rounded">Delete</button>` : ""}</div>` : ""}
            ${token ? `<div class="mt-2"><input data-comment-input="${entity.id}" class="border p-1 w-full" placeholder="Comment" /><button data-comment="${entity.id}" class="bg-green-600 text-white px-2 py-1 rounded mt-1">Comment</button></div>` : ""}
            <ul class="text-sm list-disc pl-5 mt-2">${commentsMarkup}</ul>
          </div>
        `;
      })
      .join("");

    const trialMarkup = trials
      .map(
        (trial) => `
        <div class="border rounded p-3 mb-2">
          <div class="font-semibold">Trial ${trial.id}</div>
          <div class="text-sm">status: ${trial.status}${trial.outcome ? `, outcome: ${trial.outcome}` : ""}</div>
          <div class="text-xs">agreed judges: ${(trial.agreedJudges || []).join(", ") || "none"}</div>
          ${token ? `<input data-judges-input="${trial.id}" class="border p-1 w-full mt-2" placeholder="Judge usernames (comma-separated)" />
          <button data-judges="${trial.id}" class="bg-indigo-600 text-white px-2 py-1 rounded mt-1">Propose Judges</button>
          <select data-vote-input="${trial.id}" class="border p-1 w-full mt-2"><option value="plaintiff">plaintiff</option><option value="defendant">defendant</option><option value="no_winner">no_winner</option></select>
          <button data-vote="${trial.id}" class="bg-purple-600 text-white px-2 py-1 rounded mt-1">Vote</button>
          <input data-trial-comment-input="${trial.entityId}" class="border p-1 w-full mt-2" placeholder="Trial comment" />
          <button data-trial-comment="${trial.entityId}" class="bg-green-700 text-white px-2 py-1 rounded mt-1">Comment on Trial</button>` : ""}
        </div>
      `
      )
      .join("");

    const notificationMarkup = notifications
      .map((n) => `<li>${n.read ? "✅" : "🔔"} ${n.message} (${n.entityId})</li>`)
      .join("");

    const container = h(
      "div.flex.flex-col.items-center.justify-center.min-h-screen",
      { style: "background:#F3F4F6" },
      h("div.bg-white.p-6.rounded-lg.shadow-md.w-full", { style: "max-width:72rem" })
    );
    const panel = container.querySelector("div")!;

    panel.innerHTML = `
      <button id="exit-btn" class="bg-red-500 text-white px-4 py-2 rounded w-full mb-3">Exit</button>
      <h1 class="text-2xl font-semibold mb-3">HCMIU Collaborative</h1>
      <p class="mb-3 text-sm">Public read access is always available. Login is required to create content.</p>
      ${options?.focusedEntityId ? `<section class="border rounded p-3 mb-4 bg-green-50"><div class="font-semibold">Focused from map view</div><div class="text-sm">${options.focusedEntityLabel || options.focusedEntityId}</div><div class="text-xs text-gray-700">Entity ID: ${options.focusedEntityId}</div><button id="focused-research" class="bg-green-700 text-white px-3 py-1 rounded mt-2">Find all entities referencing this map entity</button></section>` : ""}

      <div class="grid md:grid-cols-2 gap-4">
        <section class="border rounded p-3">
          <h2 class="font-semibold mb-2">Authentication</h2>
          <div class="text-sm mb-2">${me ? `Logged in as <b>${me.username}</b>` : "Not logged in"}</div>
          <input id="username" class="border p-2 w-full mb-2" placeholder="Username" />
          <input id="password" type="password" class="border p-2 w-full mb-2" placeholder="Password" />
          <div class="flex gap-2">
            <button id="signup" class="bg-blue-600 text-white px-3 py-2 rounded w-full">Sign up</button>
            <button id="login" class="bg-blue-500 text-white px-3 py-2 rounded w-full">Log in</button>
          </div>
        </section>

        <section class="border rounded p-3">
          <h2 class="font-semibold mb-2">Create Entity</h2>
          <input id="entity-title" class="border p-2 w-full mb-2" placeholder="Title" />
          <textarea id="entity-body" class="border p-2 w-full mb-2" placeholder="Body"></textarea>
          <input id="entity-refs" class="border p-2 w-full mb-2" placeholder="References (entity ids, comma-separated)" />
          <button id="create-entity" class="bg-green-600 text-white px-3 py-2 rounded w-full">Create</button>
        </section>
      </div>

      <section class="border rounded p-3 mt-4">
        <h2 class="font-semibold mb-2">Court of Justice</h2>
        <input id="trial-title" class="border p-2 w-full mb-2" placeholder="Trial title" />
        <input id="trial-defendant" class="border p-2 w-full mb-2" placeholder="Defendant username" />
        <textarea id="trial-description" class="border p-2 w-full mb-2" placeholder="Trial description"></textarea>
        <button id="create-trial" class="bg-amber-600 text-white px-3 py-2 rounded">Create Trial</button>
        <div class="mt-3">${trialMarkup}</div>
      </section>

      <section class="border rounded p-3 mt-4">
        <h2 class="font-semibold mb-2">Deep Research</h2>
        <input id="research-refs" class="border p-2 w-full mb-2" placeholder="Reference search ids (comma-separated)" />
        <button id="research-by-refs" class="bg-slate-700 text-white px-3 py-2 rounded mb-2">Find Referencing Entities</button>
        <input id="research-fulltext" class="border p-2 w-full mb-2" placeholder="Full-text query" />
        <button id="research-fulltext-btn" class="bg-slate-700 text-white px-3 py-2 rounded mb-2">Full-text Search</button>
        <input id="degree-from" class="border p-2 w-full mb-2" placeholder="Degree from entity id" />
        <input id="degree-to" class="border p-2 w-full mb-2" placeholder="Degree to entity id" />
        <button id="research-degree" class="bg-slate-700 text-white px-3 py-2 rounded">Find Degree of Separation</button>
        <pre class="bg-gray-100 p-2 mt-2 overflow-auto text-xs">${searchOutput || "No research query yet."}</pre>
      </section>

      <section class="border rounded p-3 mt-4">
        <h2 class="font-semibold mb-2">Entities (live updates via WebSocket)</h2>
        ${entityMarkup || "<div class=\"text-sm text-gray-600\">No entities yet.</div>"}
      </section>

      <section class="border rounded p-3 mt-4">
        <h2 class="font-semibold mb-2">In-app Notifications</h2>
        <ul class="list-disc pl-5 text-sm">${notificationMarkup || "<li>No notifications.</li>"}</ul>
      </section>
    `;
    root.appendChild(container);

    const byId = (id: string) => panel.querySelector(`#${id}`) as HTMLElement | null;
    const val = (id: string) => ((byId(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "").trim();

    byId("exit-btn")?.addEventListener("click", () => onExit?.());

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
              references: splitCsv(val("entity-refs")),
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

    byId("research-by-refs")?.addEventListener("click", async () => {
      const ids = val("research-refs");
      const result = await jsonFetch(`/api/research/references?ids=${encodeURIComponent(ids)}`);
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
        const from = val("degree-from");
        const to = val("degree-to");
        const result = await jsonFetch(`/api/research/degree?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        searchOutput = JSON.stringify(result, null, 2);
      } catch (error: any) {
        searchOutput = error.message;
      }
      render();
    });
    byId("focused-research")?.addEventListener("click", async () => {
      try {
        const result = await jsonFetch(`/api/research/references?ids=${encodeURIComponent(options?.focusedEntityId ?? "")}`);
        searchOutput = JSON.stringify(result, null, 2);
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
