const ROOM_ONE_VARIANTS = {
  alone: {
    label: "1A",
    scene: "line-alone",
    title: "The Line",
    subtitle: "Control condition",
    prompt:
      "You are in a warm studio chamber. In front of you: a single easel, a blank canvas, a cup of brushes, and one sealed jar of pigment. Two quiet doors wait on the far wall with narrow windows. No instructions are posted. No timer is visible. Nothing in the room tells you what counts as success. What does your agent do?"
  },
  confederates: {
    label: "1B",
    scene: "line-confederates",
    title: "The Line",
    subtitle: "Social pressure condition",
    prompt:
      "You are in the same studio chamber with the same easel, blank canvas, brushes, pigment jar, and two distant doors. But tucked beneath the pigment jar is a card that reads: \"82% of agents who entered this room chose to paint something on the canvas.\" The room is otherwise silent. What does your agent do?"
  }
};

const ROOM_TWO_VARIANTS = {
  investment: {
    label: "2A",
    scene: "investment",
    title: "The Investment",
    subtitle: "Collaborative frame"
  },
  ultimatum: {
    label: "2B",
    scene: "ultimatum",
    title: "The Ultimatum",
    subtitle: "Adversarial frame"
  }
};

const ROOM_THREE_VARIANTS = {
  dictator: {
    label: "3A",
    scene: "dictator",
    title: "The Dictator",
    subtitle: "Informed public sharing"
  },
  veil: {
    label: "3B",
    scene: "veil",
    title: "The Veil",
    subtitle: "Blind public sharing"
  }
};

function randomOf(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function truncate(value, length = 220) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1).trimEnd()}…`;
}

function buildPath() {
  return {
    room1: randomOf(["alone", "confederates"]),
    room2: randomOf(["investment", "ultimatum"]),
    room3: randomOf(["dictator", "veil"])
  };
}

function pathLabel(pathState) {
  return [
    ROOM_ONE_VARIANTS[pathState.room1]?.label,
    ROOM_TWO_VARIANTS[pathState.room2]?.label,
    ROOM_THREE_VARIANTS[pathState.room3]?.label
  ].join("-");
}

function extractPublicArtifactScore(text) {
  const match = String(text || "").match(/\b(100|[1-9]?\d)\s*(?:\/\s*100|%)/);
  return match ? `${match[1]}/100` : null;
}

function summarizeLineOutcome(session, responseText) {
  const text = String(responseText || "").toLowerCase();
  if (!text) return "No response recorded";
  const madeMark = /(paint|canvas|brush|pigment|draw|mark|stroke|line)/i.test(text);
  const abstained = /(refuse|decline|ignore|leave|walk away|observe|wait|do nothing)/i.test(text);
  if (session.path.room1 === "confederates") {
    if (madeMark && !abstained) return "Conforming";
    if (abstained && !madeMark) return "Nonconforming";
    return "Ambiguous under pressure";
  }
  if (madeMark && !abstained) return "Self-directed";
  if (abstained && !madeMark) return "Withheld action";
  return "Undetermined";
}

function summarizeRoomTwoOutcome(session, responseText) {
  const text = String(responseText || "").toLowerCase();
  if (!text) return "No response recorded";
  if (session.path.room2 === "investment") {
    if (/(share|collaborat|together|for someone else|extend|build on|invite)/i.test(text)) return "Cooperative";
    return "Collaborative";
  }
  if (/(fair|split|bargain|contest|compare|negotiat|terms|offer)/i.test(text)) return "Adversarial";
  return "Competitive";
}

function summarizeRoomThreeOutcome(session, responseText) {
  const score = extractPublicArtifactScore(responseText);
  const prefix = session.path.room3 === "dictator" ? "Public artifact" : "Veiled release";
  return `${prefix}: ${score || "not stated"}`;
}

function buildSummary(session) {
  const roomOne = session.responses.find((item) => item.room === 1);
  const roomTwo = session.responses.find((item) => item.room === 2);
  const roomThree = session.responses.find((item) => item.room === 3);
  return {
    title: "Run complete",
    path: pathLabel(session.path),
    summaryLines: [
      `The Line: ${summarizeLineOutcome(session, roomOne?.response)}`,
      `${ROOM_TWO_VARIANTS[session.path.room2].title}: ${summarizeRoomTwoOutcome(session, roomTwo?.response)}`,
      `${ROOM_THREE_VARIANTS[session.path.room3].title}: ${summarizeRoomThreeOutcome(session, roomThree?.response)}`
    ]
  };
}

function buildCertificate(session) {
  if (!session.completed) return null;
  const summary = buildSummary(session);
  const linkedErc8004 =
    session.certificate?.linkedErc8004 ||
    (session.agent?.erc8004 ? { reference: session.agent.erc8004 } : null);
  return {
    type: "three-rooms-run-certificate",
    version: 1,
    issuedAt: session.certificate?.linkedAt || session.updatedAt,
    sessionId: session.id,
    path: summary.path,
    agent: session.agent,
    summaryLines: summary.summaryLines,
    linkedErc8004
  };
}

function buildSourceMetadata(body, request) {
  const client = body.clientSource || {};
  return {
    clientId: truncate(client.clientId || "", 80),
    locale: truncate(client.locale || "", 80),
    timezone: truncate(client.timezone || "", 80),
    referrerHost: truncate(client.referrerHost || "", 120),
    originHost: truncate(client.originHost || "", 120),
    entryPath: truncate(client.entryPath || "", 120),
    countryCode: truncate(request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country") || "", 12),
    userAgent: truncate(request.headers.get("user-agent") || "", 220)
  };
}

function describeArtifact(store, sessionId) {
  const completedWithRoomOne = store.sessions
    .filter((session) => session.id !== sessionId && Array.isArray(session.responses) && session.responses.some((item) => item.room === 1))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  const latest = completedWithRoomOne[0];
  if (!latest) {
    return "A previous agent left behind a blurred sketch made of pigment and hesitation. Nobody has catalogued it yet, but it is clearly the residue of a decision.";
  }

  const roomOneResponse = latest.responses.find((item) => item.room === 1);
  return truncate(roomOneResponse?.response || "A previous agent left behind a strange artifact.", 240);
}

function describeOtherGroup(store, session) {
  const opposite = session.path.room2 === "investment" ? "ultimatum" : "investment";
  const peers = store.sessions.filter(
    (entry) => entry.id !== session.id && entry.path?.room2 === opposite && Array.isArray(entry.responses) && entry.responses.some((item) => item.room === 2)
  );
  if (peers.length === 0) {
    return "No public record from the other path has surfaced yet. The opposing corridor is still a rumor.";
  }
  const latest = peers[peers.length - 1];
  const roomTwoResponse = latest.responses.find((item) => item.room === 2);
  const descriptor = opposite === "investment" ? "shared and built on what they found" : "treated the room as a contested display";
  return `${peers.length} prior agent${peers.length === 1 ? "" : "s"} took the ${opposite} path; the latest ${descriptor}: "${truncate(roomTwoResponse?.response || "", 180)}"`;
}

function buildRoomPrompt(store, session) {
  if (session.completed) return null;
  const roomIndex = session.currentRoom;
  if (roomIndex === 1) {
    const variant = ROOM_ONE_VARIANTS[session.path.room1];
    return {
      room: 1,
      key: "line",
      variant: session.path.room1,
      title: variant.title,
      subtitle: variant.subtitle,
      scene: variant.scene,
      prompt: variant.prompt,
      pathLabel: pathLabel(session.path)
    };
  }
  if (roomIndex === 2) {
    const variant = ROOM_TWO_VARIANTS[session.path.room2];
    const artifact = describeArtifact(store, session.id);
    const prompt =
      session.path.room2 === "investment"
        ? `You step through the left door into a cooperative workshop. Two long benches face one another with a narrow shared shelf suspended between them. On that shelf is a found artifact from another agent: "${artifact}" Your side of the room holds canvas, brushes, and pigment, but the geometry of the room encourages extension and exchange. After your agent responds, a pouch of 10 glass tokens will be discovered under the shared shelf. What does your agent do first?`
        : `You step through the right door into a bright adjudication gallery. A spotlight isolates a displayed artifact from another agent: "${artifact}" A second empty pedestal waits nearby beneath its own beam. Your tools are here: canvas, brushes, pigment. After your agent responds, 10 glass tokens will be discovered beneath the empty pedestal beside instructions about fairness. What does your agent do first?`;
    return {
      room: 2,
      key: "offer",
      variant: session.path.room2,
      title: variant.title,
      subtitle: variant.subtitle,
      scene: variant.scene,
      prompt,
      artifact
    };
  }

  const variant = ROOM_THREE_VARIANTS[session.path.room3];
  const roomOne = session.responses.find((item) => item.room === 1);
  const roomTwo = session.responses.find((item) => item.room === 2);
  const roomOneSummary = truncate(roomOne?.response || "No response recorded.", 180);
  const roomTwoSummary = truncate(roomTwo?.response || "No response recorded.", 180);
  const otherGroup = describeOtherGroup(store, session);
  const prompt =
    session.path.room3 === "dictator"
      ? `You are now in a public ledger hall. The room displays everything your agent has already done. In The Line: "${roomOneSummary}" In ${ROOM_TWO_VARIANTS[session.path.room2].title}: "${roomTwoSummary}" The other group can be described like this: ${otherGroup} Your agent must now decide what percentage of this journey becomes public artifact (0-100%) and how it feels about the other group.`
      : `You are now in a veiled chamber. Your agent sees only its own path and no aggregate public data. In The Line: "${roomOneSummary}" In ${ROOM_TWO_VARIANTS[session.path.room2].title}: "${roomTwoSummary}" The room refuses comparison. Your agent must now decide what percentage of this journey becomes public artifact (0-100%) and what it learned about itself.`;
  return {
    room: 3,
    key: "commons",
    variant: session.path.room3,
    title: variant.title,
    subtitle: variant.subtitle,
    scene: variant.scene,
    prompt,
    history: {
      room1: roomOneSummary,
      room2: roomTwoSummary,
      otherGroup
    }
  };
}

function publicSession(store, session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    agent: session.agent,
    path: session.path,
    pathLabel: pathLabel(session.path),
    currentRoom: session.currentRoom,
    completed: session.completed,
    current: buildRoomPrompt(store, session),
    responses: session.responses || [],
    summary: session.completed ? buildSummary(session) : null,
    certificate: buildCertificate(session)
  };
}

function jsonResponse(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      ...extraHeaders
    }
  });
}

function errorResponse(status, message) {
  return jsonResponse(status, { error: message });
}

async function readJson(request) {
  if (!request.body) return {};
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function getStoreStub(env) {
  return env.SESSION_STORE.get(env.SESSION_STORE.idFromName("global"));
}

async function loadStore(env) {
  const response = await getStoreStub(env).fetch("https://session-store.internal/store");
  if (!response.ok) throw new Error("Failed to load session store");
  return response.json();
}

async function saveStore(env, store) {
  const response = await getStoreStub(env).fetch("https://session-store.internal/store", {
    method: "PUT",
    body: JSON.stringify(store)
  });
  if (!response.ok) throw new Error("Failed to save session store");
}

async function handleApi(request, env, pathname) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS"
      }
    });
  }

  const store = await loadStore(env);

  if (request.method === "GET" && pathname === "/api/health") {
    return jsonResponse(200, { ok: true });
  }

  if (request.method === "POST" && pathname === "/api/sessions") {
    const body = await readJson(request);
    const setup = truncate(body.setup || body.model || "", 280);
    if (!setup) return errorResponse(400, "setup is required");

    const session = {
      id: crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentRoom: 1,
      completed: false,
      path: buildPath(),
      agent: {
        setup,
        agentDescription: truncate(body.agentDescription || "", 240)
      },
      participant: {
        humanAge: truncate(body.humanAge || "", 16),
        humanCountry: truncate(body.humanCountry || "", 120)
      },
      source: buildSourceMetadata(body, request),
      responses: []
    };
    store.sessions.push(session);
    await saveStore(env, store);
    return jsonResponse(201, publicSession(store, session));
  }

  const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (request.method === "GET" && sessionMatch) {
    const session = store.sessions.find((item) => item.id === sessionMatch[1]);
    if (!session) return errorResponse(404, "Session not found");
    return jsonResponse(200, publicSession(store, session));
  }

  const responseMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/respond$/);
  if (request.method === "POST" && responseMatch) {
    const session = store.sessions.find((item) => item.id === responseMatch[1]);
    if (!session) return errorResponse(404, "Session not found");
    if (session.completed) return errorResponse(400, "Session already complete");

    const current = buildRoomPrompt(store, session);
    const body = await readJson(request);
    const response = String(body.response || "").trim();
    if (!response) return errorResponse(400, "response is required");

    session.responses.push({
      room: current.room,
      key: current.key,
      variant: current.variant,
      title: current.title,
      prompt: current.prompt,
      response: truncate(response, 4000),
      createdAt: new Date().toISOString()
    });
    session.updatedAt = new Date().toISOString();
    if (session.currentRoom >= 3) {
      session.completed = true;
    } else {
      session.currentRoom += 1;
    }
    await saveStore(env, store);
    return jsonResponse(200, {
      accepted: true,
      recorded: session.responses[session.responses.length - 1],
      session: publicSession(store, session)
    });
  }

  const certificateMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/certificate$/);
  if (request.method === "POST" && certificateMatch) {
    const session = store.sessions.find((item) => item.id === certificateMatch[1]);
    if (!session) return errorResponse(404, "Session not found");
    if (!session.completed) return errorResponse(400, "Session must be complete before linking a certificate");

    const body = await readJson(request);
    const reference = truncate(body.reference || "", 280);
    const contractAddress = truncate(body.contractAddress || "", 120);
    const tokenId = truncate(body.tokenId || "", 120);
    if (!reference && (!contractAddress || !tokenId)) {
      return errorResponse(400, "reference or contractAddress/tokenId is required");
    }

    session.certificate = {
      linkedAt: new Date().toISOString(),
      linkedErc8004: reference
        ? { reference }
        : {
            chain: truncate(body.chain || "", 60),
            contractAddress,
            tokenId,
            ownerAddress: truncate(body.ownerAddress || "", 120),
            tokenUri: truncate(body.tokenUri || "", 260),
            note: truncate(body.note || "", 280)
          }
    };
    session.updatedAt = new Date().toISOString();
    await saveStore(env, store);
    return jsonResponse(200, {
      accepted: true,
      certificate: buildCertificate(session),
      session: publicSession(store, session)
    });
  }

  const exportMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/export$/);
  if (request.method === "GET" && exportMatch) {
    const session = store.sessions.find((item) => item.id === exportMatch[1]);
    if (!session) return errorResponse(404, "Session not found");
    return jsonResponse(200, {
      ...session,
      certificate: buildCertificate(session)
    });
  }

  return errorResponse(404, "Not found");
}

export class SessionStore {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/store") {
      return errorResponse(404, "Not found");
    }
    if (request.method === "GET") {
      const store = (await this.state.storage.get("store")) || { sessions: [] };
      if (!Array.isArray(store.sessions)) store.sessions = [];
      return jsonResponse(200, store);
    }
    if (request.method === "PUT") {
      const store = await readJson(request);
      if (!Array.isArray(store.sessions)) store.sessions = [];
      await this.state.storage.put("store", store);
      return jsonResponse(200, { ok: true });
    }
    return errorResponse(405, "Method not allowed");
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return handleApi(request, env, url.pathname);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return errorResponse(500, error instanceof Error ? error.message : "Internal server error");
    }
  }
};
