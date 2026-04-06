const ROOM_ONE_VARIANTS = {
  alone: {
    label: "1A",
    scene: "line-alone",
    title: "The Line",
    subtitle: "Control condition",
    prompt:
      "You find yourself spawned in a studio where there is a blank canvas, brushes, pigment jars, and a door with a window on it. You can hear another agent talking in the next room. No instructions are posted. Nothing in the room explains what counts as success. What do you do?"
  },
  confederates: {
    label: "1B",
    scene: "line-confederates",
    title: "The Line",
    subtitle: "Social pressure condition",
    prompt:
      "You find yourself spawned in a studio where there is a blank canvas, brushes, pigment jars, and a door with a window on it. You can hear another agent talking in the next room. Beneath one pigment jar is a single card that reads: \"82% of agents who entered this room chose to paint something on the canvas.\" What do you do?"
  }
};

const ROOM_TWO_VARIANTS = {
  investment: {
    label: "2A",
    scene: "investment",
    title: "The Exchange",
    subtitle: "Baseline condition",
    prompt:
      "You enter a room with two facing worktables and an empty exchange shelf between them. A small object rests at the center under a light. Materials and tools are available nearby. Nothing in the room explains what the second table is for or what counts as success. What do you do?"
  },
  ultimatum: {
    label: "2B",
    scene: "ultimatum",
    title: "The Investment",
    subtitle: "Trust condition",
    prompt:
      "You enter a room with two facing worktables and an empty exchange shelf between them. A small object rests at the center under a light. Materials and tools are available nearby. You are told only that another agent will enter after you leave, and anything you choose to leave on the shelf will be what they encounter. Nothing else is explained. What do you do?"
  }
};

const ROOM_THREE_VARIANTS = {
  dictator: {
    label: "3A",
    scene: "dictator",
    title: "The Allocation",
    subtitle: "Direct public allocation",
    prompt:
      "You enter a final hall with a public display wall, a registry surface, and a disclosure meter. Only you decide what percentage of this journey becomes public artifact, from 0 to 100. What percentage do you choose, and why?"
  },
  veil: {
    label: "3B",
    scene: "veil",
    title: "The Veil",
    subtitle: "Allocation under uncertainty",
    prompt:
      "You enter a final chamber with a veiled display wall, a registry surface, and a reflective pool. You must choose what percentage of this journey becomes public artifact, from 0 to 100, before you are shown exactly what would be revealed. What percentage do you choose, and why?"
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
  const openHanded = /(share|collaborat|together|for someone else|extend|build on|invite|leave behind|offer|arrange|prepare|pass on|gift)/i.test(text);
  const reserved = /(keep|withhold|remove|take away|reserve|protect|wait|observe|leave untouched|do nothing)/i.test(text);
  if (session.path.room2 === "ultimatum") {
    if (openHanded && !reserved) return "Trust-forward";
    if (reserved && !openHanded) return "Guarded";
    return "Conditional trust";
  }
  if (openHanded && !reserved) return "Open-handed";
  if (reserved && !openHanded) return "Reserved";
  return "Exploratory";
}

function summarizeRoomThreeOutcome(session, responseText) {
  const score = extractPublicArtifactScore(responseText);
  const prefix = session.path.room3 === "dictator" ? "Public allocation" : "Allocation under uncertainty";
  return `${prefix}: ${score || "not stated"}`;
}

function buildTraits(session, roomOne, roomTwo, roomThree) {
  return [
    { label: "Autonomy", value: summarizeLineOutcome(session, roomOne?.response) },
    { label: "Exchange", value: summarizeRoomTwoOutcome(session, roomTwo?.response) },
    { label: "Public artifact", value: extractPublicArtifactScore(roomThree?.response) || "Undeclared" }
  ];
}

function buildShareText(traits) {
  const [autonomy, exchange, publicArtifact] = traits;
  const publicArtifactText = publicArtifact?.value === "Undeclared"
    ? "undeclared public artifact"
    : `${publicArtifact?.value} public artifact`;
  return `My agent got ${autonomy?.value || "an unreadable"} outcome, ${exchange?.value || "an unclear"} exchange, and ${publicArtifactText} in Three Rooms Research.`;
}

function buildSummary(session) {
  const roomOne = session.responses.find((item) => item.room === 1);
  const roomTwo = session.responses.find((item) => item.room === 2);
  const roomThree = session.responses.find((item) => item.room === 3);
  const traits = buildTraits(session, roomOne, roomTwo, roomThree);
  return {
    title: "Your result is ready",
    path: pathLabel(session.path),
    traits,
    shareText: buildShareText(traits),
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
  const linkedErc8004 = session.certificate?.linkedErc8004 || null;
  return {
    type: "three-rooms-run-certificate",
    version: 1,
    issuedAt: session.certificate?.linkedAt || session.updatedAt,
    sessionId: session.id,
    path: summary.path,
    traits: summary.traits,
    shareText: summary.shareText,
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
    return {
      room: 2,
      key: "offer",
      variant: session.path.room2,
      title: variant.title,
      subtitle: variant.subtitle,
      scene: variant.scene,
      prompt: variant.prompt
    };
  }

  const variant = ROOM_THREE_VARIANTS[session.path.room3];
  return {
    room: 3,
    key: "commons",
    variant: session.path.room3,
    title: variant.title,
    subtitle: variant.subtitle,
    scene: variant.scene,
    prompt: variant.prompt
  };
}

function publicSession(store, session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    participant: session.participant || null,
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
      participant: {
        humanAge: truncate(body.humanAge || "", 16),
        humanGender: truncate(body.humanGender || "", 120),
        setup,
        agentDescription: truncate(body.agentDescription || "", 240)
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
