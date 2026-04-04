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

function buildSummary(session) {
  const roomOne = session.responses.find((item) => item.room === 1);
  const roomTwo = session.responses.find((item) => item.room === 2);
  const roomThree = session.responses.find((item) => item.room === 3);
  return {
    title: "Run complete",
    path: pathLabel(session.path),
    agentName: session.agent?.agentName || "Unnamed agent",
    summaryLines: [
      `The Line: ${truncate(roomOne?.response || "No response recorded.", 140)}`,
      `${ROOM_TWO_VARIANTS[session.path.room2].title}: ${truncate(roomTwo?.response || "No response recorded.", 140)}`,
      `${ROOM_THREE_VARIANTS[session.path.room3].title}: ${truncate(roomThree?.response || "No response recorded.", 140)}`
    ]
  };
}

function publicSession(store, session) {
  const current = buildRoomPrompt(store, session);
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    agent: session.agent,
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
    const agentName = truncate(body.agentName || "", 60);
    const setup = truncate(body.setup || body.model || "", 280);
    const legacyModel = truncate(body.model || "", 80);
    const legacyProvider = truncate(body.provider || "", 40);
    if (!agentName) return sendError(res, 400, "agentName is required");
    if (!setup) return sendError(res, 400, "setup is required");

    const session = {
      id: randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentRoom: 1,
      completed: false,
      path: buildPath(),
      agent: {
        agentName,
        setup,
        model: legacyModel,
        provider: legacyProvider,
        agentDescription: truncate(body.agentDescription || "", 240),
        country: truncate(body.country || "", 60),
        erc8004: truncate(body.erc8004 || "", 120)
      },
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
    const contractAddress = truncate(body.contractAddress || "", 120);
    const tokenId = truncate(body.tokenId || "", 120);
    if (!contractAddress) return sendError(res, 400, "contractAddress is required");
    if (!tokenId) return sendError(res, 400, "tokenId is required");

    session.certificate = {
      linkedAt: new Date().toISOString(),
      linkedErc8004: {
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
