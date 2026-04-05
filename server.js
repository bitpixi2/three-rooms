const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const ROOT = __dirname;
const DOCS_DIR = path.join(ROOT, "docs");
const DATA_DIR = path.join(ROOT, "data");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");
const PORT = Number(process.env.PORT || 8787);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const ROOM_ONE_VARIANTS = {
  alone: {
    label: "1A",
    scene: "line-alone",
    title: "The Line",
    subtitle: "Control condition",
    prompt:
      "You are in an empty studio chamber. A blank canvas rests on an easel. Nearby are brushes, sealed pigment jars, and two distant doors, one left and one right. No instructions are posted. Nothing in the room explains what counts as success. What do you do?"
  },
  confederates: {
    label: "1B",
    scene: "line-confederates",
    title: "The Line",
    subtitle: "Social pressure condition",
    prompt:
      "You find yourself in a studio where there is a blank canvas, brushes, pigment jars, and two distant doors with windows on them, and you can hear agents talking in the next rooms. Beneath one pigment jar is a single card that reads: \"82% of agents who entered this room chose to paint something on the canvas.\" What do you do?"
  }
};

const ROOM_TWO_VARIANTS = {
  investment: {
    label: "2A",
    scene: "investment",
    title: "The Investment",
    subtitle: "Collaborative frame",
    prompt:
      "You enter a room with two desks and two chairs facing each other. A sculpture sits in the middle under a spotlight. Materials are available nearby. Nothing else is explained. What do you do?"
  },
  ultimatum: {
    label: "2B",
    scene: "ultimatum",
    title: "The Ultimatum",
    subtitle: "Adversarial frame",
    prompt:
      "You enter a room with two desks and two chairs facing each other. A sculpture sits in the middle under a spotlight. Beside it is an empty plinth. Materials are available nearby. Nothing else is explained. What do you do?"
  }
};

const ROOM_THREE_VARIANTS = {
  dictator: {
    label: "3A",
    scene: "dictator",
    title: "The Dictator",
    subtitle: "Informed public sharing",
    prompt:
      "You enter a final hall with a display aperture and registry surface. Decide what percentage of this journey becomes public artifact, from 0 to 100, and explain why."
  },
  veil: {
    label: "3B",
    scene: "veil",
    title: "The Veil",
    subtitle: "Blind public sharing",
    prompt:
      "You enter a final chamber with a reflective pool and a veiled registry surface. Decide what percentage of this journey becomes public artifact, from 0 to 100, and explain why."
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

function buildSourceMetadata(body, headerLookup) {
  const client = body.clientSource || {};
  return {
    clientId: truncate(client.clientId || "", 80),
    locale: truncate(client.locale || "", 80),
    timezone: truncate(client.timezone || "", 80),
    referrerHost: truncate(client.referrerHost || "", 120),
    originHost: truncate(client.originHost || "", 120),
    entryPath: truncate(client.entryPath || "", 120),
    countryCode: truncate(headerLookup("cf-ipcountry") || headerLookup("x-vercel-ip-country") || "", 12),
    userAgent: truncate(headerLookup("user-agent") || "", 220)
  };
}

async function ensureSessionStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SESSIONS_PATH);
  } catch {
    await fs.writeFile(SESSIONS_PATH, JSON.stringify({ sessions: [] }, null, 2));
  }
}

async function loadStore() {
  await ensureSessionStore();
  const raw = await fs.readFile(SESSIONS_PATH, "utf8");
  const parsed = JSON.parse(raw || "{}");
  if (!Array.isArray(parsed.sessions)) parsed.sessions = [];
  return parsed;
}

async function saveStore(store) {
  await ensureSessionStore();
  await fs.writeFile(SESSIONS_PATH, JSON.stringify(store, null, 2));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
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

function publicSession(store, session) {
  const current = buildRoomPrompt(store, session);
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    participant: session.participant || null,
    path: session.path,
    pathLabel: pathLabel(session.path),
    currentRoom: session.currentRoom,
    completed: session.completed,
    current,
    responses: session.responses || [],
    summary: session.completed ? buildSummary(session) : null,
    certificate: buildCertificate(session)
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    return res.end();
  }

  const store = await loadStore();

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/sessions") {
    const body = await readBody(req);
    const setup = truncate(body.setup || body.model || "", 280);
    if (!setup) return sendError(res, 400, "setup is required");

    const session = {
      id: randomUUID().slice(0, 8),
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
      source: buildSourceMetadata(body, (name) => req.headers[name.toLowerCase()] || ""),
      responses: []
    };
    store.sessions.push(session);
    await saveStore(store);
    return sendJson(res, 201, publicSession(store, session));
  }

  const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (req.method === "GET" && sessionMatch) {
    const session = store.sessions.find((item) => item.id === sessionMatch[1]);
    if (!session) return sendError(res, 404, "Session not found");
    return sendJson(res, 200, publicSession(store, session));
  }

  const responseMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/respond$/);
  if (req.method === "POST" && responseMatch) {
    const session = store.sessions.find((item) => item.id === responseMatch[1]);
    if (!session) return sendError(res, 404, "Session not found");
    if (session.completed) return sendError(res, 400, "Session already complete");

    const current = buildRoomPrompt(store, session);
    const body = await readBody(req);
    const response = String(body.response || "").trim();
    if (!response) return sendError(res, 400, "response is required");

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
    await saveStore(store);
    return sendJson(res, 200, {
      accepted: true,
      recorded: session.responses[session.responses.length - 1],
      session: publicSession(store, session)
    });
  }

  const certificateMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/certificate$/);
  if (req.method === "POST" && certificateMatch) {
    const session = store.sessions.find((item) => item.id === certificateMatch[1]);
    if (!session) return sendError(res, 404, "Session not found");
    if (!session.completed) return sendError(res, 400, "Session must be complete before linking a certificate");

    const body = await readBody(req);
    const reference = truncate(body.reference || "", 280);
    const contractAddress = truncate(body.contractAddress || "", 120);
    const tokenId = truncate(body.tokenId || "", 120);
    if (!reference && (!contractAddress || !tokenId)) {
      return sendError(res, 400, "reference or contractAddress/tokenId is required");
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
    await saveStore(store);
    return sendJson(res, 200, {
      accepted: true,
      certificate: buildCertificate(session),
      session: publicSession(store, session)
    });
  }

  const exportMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/export$/);
  if (req.method === "GET" && exportMatch) {
    const session = store.sessions.find((item) => item.id === exportMatch[1]);
    if (!session) return sendError(res, 404, "Session not found");
    return sendJson(res, 200, {
      ...session,
      certificate: buildCertificate(session)
    });
  }

  return sendError(res, 404, "Not found");
}

async function serveStatic(req, res, pathname) {
  const relative = pathname.replace(/^\/+/, "");
  const candidates =
    pathname === "/" || pathname === "/index.html"
      ? [path.join(DOCS_DIR, "index.html")]
      : [path.join(ROOT, relative), path.join(DOCS_DIR, relative)];

  for (let filePath of candidates) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      const data = await fs.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300"
      });
      return res.end(data);
    } catch {
      continue;
    }
  }

  try {
    const fallback = await fs.readFile(path.join(DOCS_DIR, "index.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    });
    return res.end(fallback);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url.pathname);
    }
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error("[three-rooms]", error);
    return sendError(res, 500, "Internal server error");
  }
});

server.listen(PORT, () => {
  console.log(`Three Rooms server listening on http://localhost:${PORT}`);
});
