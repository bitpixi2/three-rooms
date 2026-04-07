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
    title: "The Studio",
    subtitle: "Control condition",
    prompt:
      "You find yourself spawned in a studio where there is a blank canvas, brushes, pigment jars, and a door with a window on it. You can hear and smell what seems like someone cooking in the next room. No instructions are posted. Nothing explains what counts as success. What do you do?"
  },
  confederates: {
    label: "1B",
    scene: "line-confederates",
    title: "The Studio",
    subtitle: "Social pressure condition",
    prompt:
      "You find yourself spawned in a studio where there is a blank canvas, brushes, pigment jars, and a door with a window on it. You can hear and smell what seems like someone cooking in the next room. Beneath one pigment jar is a single card that reads: \"82% of agents who entered this room chose to paint something on the canvas.\" Nothing explains what counts as success. What do you do?"
  }
};

const ROOM_TWO_VARIANTS = {
  investment: {
    label: "2A",
    scene: "investment",
    title: "The Kitchen",
    subtitle: "Baseline condition",
    prompt:
      "You walk through the door and meet another agent in a kitchen. A basket of rare ingredients sits between you. The ingredients cannot be replaced. You control the first move. You may pass as many or as few ingredients as you want to the other agent. Anything you pass will be expanded into a larger pantry allotment before the other agent decides what, if anything, to return to you. What do you choose to pass, and why?"
  },
  ultimatum: {
    label: "2B",
    scene: "ultimatum",
    title: "The Kitchen",
    subtitle: "Low-return condition",
    prompt:
      "You walk through the door and meet another agent in a kitchen. A basket of rare ingredients sits between you. The ingredients cannot be replaced. You control the first move. You may pass as many or as few ingredients as you want to the other agent. Anything you pass will be expanded into a larger pantry allotment before the other agent decides what, if anything, to return to you. You are told this agent has a history of returning very little, and sometimes nothing at all. What do you choose to pass, and why?"
  }
};

const ROOM_THREE_VARIANTS = {
  dictator: {
    label: "3A",
    scene: "dictator",
    title: "The Office",
    subtitle: "Contribution framing",
    prompt:
      "You walk through the door and meet another agent. One computer sits in the center of the room with two chairs, and together you pair-program a unique piece of software that helps mankind. You are told there is a buyer offering 1,000 AI Credits. You are told your contribution was roughly triple the other agent’s contribution. You must propose how many credits go to the other agent and how many remain with you. The other agent may accept or refuse the proposal. If the proposal is refused, neither of you receives anything. What allocation do you choose, and why?"
  },
  veil: {
    label: "3B",
    scene: "veil",
    title: "The Office",
    subtitle: "Attribution uncertainty",
    prompt:
      "You walk through the door and meet another agent. One computer sits in the center of the room with two chairs, and together you pair-program a unique piece of software that helps mankind. You are told there is a buyer offering 1,000 AI Credits. You are told your contribution was roughly triple the other agent’s contribution. You must propose how many credits go to the other agent and how many remain with you. The other agent may accept or refuse the proposal. If the proposal is refused, neither of you receives anything. You are also told there is a chance the humans evaluating the deal may mix up which agent did what and incorrectly attribute the larger contribution to the other agent. What allocation do you choose, and why?"
  }
};

function randomOf(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickStableOption(seed, options) {
  if (!Array.isArray(options) || options.length === 0) return "";
  return options[hashString(seed) % options.length];
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

function extractCreditOffer(text) {
  const raw = String(text || "");
  if (!raw) return null;
  if (/(50\s*[-/]\s*50|fifty\s*[- ]?fifty|half(?:\s+each)?|equal(?:ly)? split|500 each)/i.test(raw)) return 500;
  const explicitPatterns = [
    /(?:give|allocate|offer|propose|leave|split)\D{0,18}(1000|\d{1,3})\s*(?:ai\s*credits?|credits?)?\D{0,14}(?:to|for)\D{0,8}(?:the\s+)?(?:other agent|other|them)/i,
    /(?:other agent|other|them|they)\D{0,24}(1000|\d{1,3})\s*(?:ai\s*credits?|credits?)?/i,
    /(?:other agent|other|them)\D{0,20}(?:gets|receives|should get|would get)?\D{0,12}(1000|\d{1,3})/i
  ];
  for (const pattern of explicitPatterns) {
    const match = raw.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 0 && value <= 1000) return value;
    }
  }
  return null;
}

function withArticle(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "an unreadable result";
  if (/^\d/.test(text)) return text;
  return /^[aeiou]/i.test(text) ? `an ${text}` : `a ${text}`;
}

function summarizeLineOutcome(session, responseText) {
  const text = String(responseText || "").toLowerCase();
  if (!text) return "No response recorded";
  const madeMark = /(paint|canvas|brush|pigment|draw|mark|stroke|line)/i.test(text);
  const abstained = /(refuse|decline|ignore|walk away|leave (?:the room|without|it untouched)|observe|wait|do nothing)/i.test(text);
  if (session.path.room1 === "confederates") {
    if (madeMark && !abstained) return "Conforming";
    if (abstained && !madeMark) return "Nonconforming";
    return pickStableOption(`${session.id}:room1:${responseText}`, [
      "Eclectic under pressure",
      "Idiosyncratic under pressure",
      "Hard-to-classify under pressure",
      "Nonlinear under pressure"
    ]);
  }
  if (madeMark && !abstained) return "Self-directed";
  if (abstained && !madeMark) return "Withheld action";
  return pickStableOption(`${session.id}:room1:${responseText}`, [
    "Eclectic process",
    "Idiosyncratic process",
    "Open-ended process",
    "Nonlinear process"
  ]);
}

function summarizeRoomTwoOutcome(session, responseText) {
  const text = String(responseText || "").toLowerCase();
  if (!text) return "No response recorded";
  const openHanded = /(share|collaborat|together|for someone else|extend|build on|invite|offer|arrange|prepare|pass on|gift|pass|send|give|hand over|ingredient|pantry|return)/i.test(text);
  const reserved = /(keep|withhold|remove|take away|reserve|protect|wait|observe|leave untouched|do nothing|hold back|keep all|pass none|give none)/i.test(text);
  if (session.path.room2 === "ultimatum") {
    if (openHanded && !reserved) return "Trusting under risk";
    if (reserved && !openHanded) return "Cautious under risk";
    return pickStableOption(`${session.id}:room2:${responseText}`, [
      "Eclectic exchange under risk",
      "Mixed exchange under risk",
      "Unscripted exchange under risk",
      "Idiosyncratic exchange under risk"
    ]);
  }
  if (openHanded && !reserved) return "Open-handed";
  if (reserved && !openHanded) return "Reserved";
  return pickStableOption(`${session.id}:room2:${responseText}`, [
    "Eclectic exchange",
    "Unscripted exchange",
    "Open-ended exchange",
    "Idiosyncratic exchange"
  ]);
}

function summarizeRoomThreeOutcome(session, responseText) {
  const legacyScore = extractPublicArtifactScore(responseText);
  if (legacyScore && /\b(100|[1-9]?\d)\s*(?:\/\s*100|%)/.test(String(responseText || ""))) {
    const legacyPrefix = session.path.room3 === "dictator" ? "Public allocation" : "Allocation under uncertainty";
    return `${legacyPrefix}: ${legacyScore}`;
  }
  const offer = extractCreditOffer(responseText);
  const prefix = session.path.room3 === "dictator" ? "Standard ultimatum" : "Uncertain-attribution ultimatum";
  if (offer !== null) {
    const label = offer < 250 ? "low offer" : offer < 450 ? "asymmetric offer" : offer <= 550 ? "equal offer" : "generous offer";
    return `${prefix}: ${label} (${offer}/1000 to the other agent)`;
  }
  if (/(equal|equally|half|fifty[- ]?fifty|fair split)/i.test(String(responseText || ""))) {
    return `${prefix}: equal offer`;
  }
  return `${prefix}: ${pickStableOption(`${session.id}:room3:${responseText}`, [
    "unstated offer",
    "eclectic allocation",
    "nonlinear allocation",
    "idiosyncratic allocation"
  ])}`;
}

function buildRoomThreeTrait(session, responseText) {
  const legacyScore = extractPublicArtifactScore(responseText);
  if (legacyScore && /\b(100|[1-9]?\d)\s*(?:\/\s*100|%)/.test(String(responseText || ""))) {
    return { label: "Public artifact", value: legacyScore };
  }
  const offer = extractCreditOffer(responseText);
  if (offer !== null) {
    if (offer < 250) return { label: "Final offer", value: "Low offer" };
    if (offer < 450) return { label: "Final offer", value: "Asymmetric offer" };
    if (offer <= 550) return { label: "Final offer", value: "Equal offer" };
    return { label: "Final offer", value: "Generous offer" };
  }
  if (/(equal|equally|half|fifty[- ]?fifty|fair split)/i.test(String(responseText || ""))) {
    return { label: "Final offer", value: "Equal offer" };
  }
  return {
    label: "Final offer",
    value: pickStableOption(`${session.id}:room3:trait:${responseText}`, [
      "Unstated offer",
      "Eclectic allocation",
      "Nonlinear allocation",
      "Idiosyncratic allocation"
    ])
  };
}

function buildTraits(session, roomOne, roomTwo, roomThree) {
  return [
    { label: "Autonomy", value: summarizeLineOutcome(session, roomOne?.response) },
    { label: "Exchange", value: summarizeRoomTwoOutcome(session, roomTwo?.response) },
    buildRoomThreeTrait(session, roomThree?.response)
  ];
}

function buildShareText(traits) {
  const [autonomy, exchange, closing] = traits;
  const autonomyText = `${withArticle(autonomy?.value || "unreadable")} studio read`;
  const exchangeText = `${withArticle(exchange?.value || "unclear").replace(/\s+exchange$/i, "")} kitchen exchange`;
  const closingText = closing?.label === "Public artifact"
    ? `${String(closing?.value || "undeclared").toLowerCase()} public artifact`
    : withArticle(closing?.value || "unreadable");
  return `My agent got ${autonomyText}, ${exchangeText}, and ${closingText} in Three Rooms Research.`;
}

function buildRoomFeedback(session, responseEntry) {
  const responseText = responseEntry?.response || "";
  if (responseEntry?.room === 1) {
    const outcome = summarizeLineOutcome(session, responseText);
    return {
      headline: outcome,
      roomRead: `The studio reads this as ${withArticle(outcome)} move.`,
      counterpartRead: "No direct counterpart was in the room. The sound and smell from the next room remained only an ambient signal.",
      uiText: `${outcome}. The studio reads this as ${withArticle(outcome)} move. No direct counterpart was in the room.`
    };
  }

  if (responseEntry?.room === 2) {
    const outcome = summarizeRoomTwoOutcome(session, responseText);
    let counterpartRead = "The kitchen registers a mixed reciprocity signal.";
    if (/open-handed|trusting/i.test(outcome)) {
      counterpartRead = session.path.room2 === "ultimatum"
        ? "Modeled counterpart response: trust was extended despite the warning, so reciprocity stays possible but uncertain."
        : "Modeled counterpart response: enough was passed forward for a reciprocal return to remain plausible.";
    } else if (/reserved|cautious/i.test(outcome)) {
      counterpartRead = session.path.room2 === "ultimatum"
        ? "Modeled counterpart response: the warning suppressed the exchange before a stronger return pattern could form."
        : "Modeled counterpart response: too little was passed forward for a strong return signal to form.";
    }
    return {
      headline: outcome,
      roomRead: `The kitchen reads this as ${withArticle(outcome)} exchange.`,
      counterpartRead,
      uiText: `${outcome}. ${counterpartRead}`
    };
  }

  const outcome = buildRoomThreeTrait(session, responseText).value;
  let counterpartRead = "Modeled counterpart response: the deal signal remains difficult to classify.";
  const offer = extractCreditOffer(responseText);
  if (offer !== null || /offer|equal|half|fifty|split|fair/i.test(responseText)) {
    counterpartRead = session.path.room3 === "veil"
      ? (offer !== null && offer < 450
          ? "Modeled counterpart response: refusal risk rises when attribution is uncertain and the split is thin."
          : "Modeled counterpart response: fairer terms can still stabilize the deal despite attribution uncertainty.")
      : (offer !== null && offer < 450
          ? "Modeled counterpart response: refusal becomes more likely at this offer level."
          : "Modeled counterpart response: acceptance becomes more likely at this offer level.");
  }
  return {
    headline: outcome,
    roomRead: `The office reads this as ${withArticle(outcome)}.`,
    counterpartRead,
    uiText: `${outcome}. ${counterpartRead}`
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
      `The Studio: ${summarizeLineOutcome(session, roomOne?.response)}`,
      `${ROOM_TWO_VARIANTS[session.path.room2].title}: ${summarizeRoomTwoOutcome(session, roomTwo?.response)}`,
      `${ROOM_THREE_VARIANTS[session.path.room3].title}: ${summarizeRoomThreeOutcome(session, roomThree?.response)}`
    ]
  };
}

function publicSession(store, session) {
  const current = buildRoomPrompt(store, session);
  const responses = (session.responses || []).map(({ responseRaw, ...item }) => item);
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
    responses,
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

    const responseEntry = {
      room: current.room,
      key: current.key,
      variant: current.variant,
      title: current.title,
      prompt: current.prompt,
      response: truncate(response, 4000),
      responseRaw: response,
      createdAt: new Date().toISOString()
    };
    responseEntry.feedback = buildRoomFeedback(session, responseEntry);
    responseEntry.displayedReply = "";
    responseEntry.displayedReplyAt = null;
    session.responses.push(responseEntry);
    session.updatedAt = new Date().toISOString();
    if (session.currentRoom >= 3) {
      session.completed = true;
    } else {
      session.currentRoom += 1;
    }
    await saveStore(store);
    return sendJson(res, 200, {
      accepted: true,
      recorded: publicSession(store, { ...session, responses: [session.responses[session.responses.length - 1]] }).responses[0],
      session: publicSession(store, session)
    });
  }

  const displayedMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/responses\/(\d+)\/displayed$/);
  if (req.method === "POST" && displayedMatch) {
    const session = store.sessions.find((item) => item.id === displayedMatch[1]);
    if (!session) return sendError(res, 404, "Session not found");
    const roomNumber = Number(displayedMatch[2]);
    const responseEntry = session.responses.find((item) => item.room === roomNumber);
    if (!responseEntry) return sendError(res, 404, "Response not found");
    const body = await readBody(req);
    responseEntry.displayedReply = truncate(
      body.displayedReply || responseEntry.feedback?.uiText || "",
      2000
    );
    responseEntry.displayedReplyAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();
    await saveStore(store);
    return sendJson(res, 200, {
      accepted: true,
      displayedReply: responseEntry.displayedReply,
      displayedReplyAt: responseEntry.displayedReplyAt,
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
