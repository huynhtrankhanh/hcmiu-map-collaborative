import test from "node:test";
import assert from "node:assert/strict";
import sodium from "libsodium-wrappers-sumo";
import { createServer } from "../server.mjs";

const fetchJson = async (base, path, options = {}, token) => {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  return body;
};

const pwhash = async (password, saltBase64) => {
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
  );
  return sodium.to_base64(derived, sodium.base64_variants.ORIGINAL);
};

test("comprehensive collaborative flow", async () => {
  const port = 3900 + Math.floor(Math.random() * 200);
  const server = await createServer({ port, useInMemory: true, allowedOrigin: "*" });
  const base = `http://127.0.0.1:${port}`;

  try {
    const signup = async (username, password) => {
      const start = await fetchJson(base, "/api/auth/signup/start", { method: "POST", body: JSON.stringify({ username }) });
      const clientHash = await pwhash(password, start.clientSalt);
      const finish = await fetchJson(base, "/api/auth/signup/finish", {
        method: "POST",
        body: JSON.stringify({ username, clientHash, clientSalt: start.clientSalt, serverSalt: start.serverSalt }),
      });
      return finish;
    };

    const plaintiff = await signup("plaintiff", "pw1");
    const defendant = await signup("defendant", "pw2");
    const judge = await signup("judge", "pw3");

    const post = await fetchJson(base, "/api/entities", {
      method: "POST",
      body: JSON.stringify({ type: "post", title: "A", body: "Entity A", references: [] }),
    }, plaintiff.token);

    const mapEntityResult = await fetchJson(base, "/api/map/entity?constructName=A1.109&floor=1");
    assert.equal(mapEntityResult.entity.type, "map_location");
    assert.equal(mapEntityResult.comments.length, 0);

    await fetchJson(base, `/api/entities/${post.entity.id}/follow`, { method: "POST" }, defendant.token);
    await fetchJson(base, `/api/entities/${post.entity.id}/unfollow`, { method: "POST" }, defendant.token);
    await fetchJson(base, `/api/entities/${post.entity.id}/follow`, { method: "POST" }, defendant.token);

    const comment = await fetchJson(base, "/api/entities", {
      method: "POST",
      body: JSON.stringify({ type: "comment", title: "", body: "I comment", parentEntityId: post.entity.id, references: [post.entity.id] }),
    }, plaintiff.token);
    assert.ok(comment.entity.id);
    const allEntities = await fetchJson(base, "/api/entities");
    const plaintiffUserEntity = allEntities.entities.find((x) => x.type === "user" && x.createdBy === plaintiff.user.id);
    assert.ok(plaintiffUserEntity?.id);
    assert.ok(comment.entity.references.includes(plaintiffUserEntity.id));

    const edited = await fetchJson(base, `/api/entities/${post.entity.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: "Entity A edited" }),
    }, plaintiff.token);
    assert.equal(edited.entity.body, "Entity A edited");

    const notifications = await fetchJson(base, "/api/notifications", {}, defendant.token);
    assert.equal(notifications.notifications.length, 1);

    const trial = await fetchJson(base, "/api/trials", {
      method: "POST",
      body: JSON.stringify({ title: "Case", description: "Case body", defendantUsername: "defendant" }),
    }, plaintiff.token);

    await fetchJson(base, `/api/trials/${trial.trial.id}/propose-judges`, {
      method: "POST",
      body: JSON.stringify({ judges: ["judge"] }),
    }, plaintiff.token);

    const agreed = await fetchJson(base, `/api/trials/${trial.trial.id}/propose-judges`, {
      method: "POST",
      body: JSON.stringify({ judges: ["judge"] }),
    }, defendant.token);
    assert.equal(agreed.trial.status, "active");

    const voted = await fetchJson(base, `/api/trials/${trial.trial.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ vote: "plaintiff" }),
    }, judge.token);
    assert.equal(voted.trial.status, "resolved");

    const refs = await fetchJson(base, `/api/research/references?ids=${post.entity.id}`);
    assert.ok(refs.entities.length >= 1);

    const fulltext = await fetchJson(base, "/api/research/fulltext?q=Entity%20A");
    assert.ok(fulltext.entities.some((x) => x.id === post.entity.id));

    const degree = await fetchJson(base, `/api/research/degree?from=${comment.entity.id}&to=${post.entity.id}`);
    assert.deepEqual(degree.path, [comment.entity.id, post.entity.id]);
    const reverseDegree = await fetchJson(base, `/api/research/degree?from=${post.entity.id}&to=${comment.entity.id}`);
    assert.deepEqual(reverseDegree.path, [post.entity.id, comment.entity.id]);

    await fetchJson(base, `/api/entities/${comment.entity.id}`, { method: "DELETE" }, plaintiff.token);
    const afterDelete = await fetchJson(base, `/api/entities?parentEntityId=${post.entity.id}`);
    assert.equal(afterDelete.entities.length, 0);
  } finally {
    await server.close();
  }
});
