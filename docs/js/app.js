(function () {
    const app = document.getElementById("app");
    const state = {
        session: null,
        transcript: [],
        currentView: "intro"
    };
    const API_ORIGIN = window.location.hostname.endsWith("github.io")
        ? "https://three-rooms.deviantclaw.workers.dev"
        : "";
    const transitionOverlay = document.getElementById("transition-overlay");
    const transitionKicker = transitionOverlay?.querySelector('[data-bind="transition-kicker"]');
    const transitionTitle = transitionOverlay?.querySelector('[data-bind="transition-title"]');
    const transitionBody = transitionOverlay?.querySelector('[data-bind="transition-body"]');
    const transitionNote = transitionOverlay?.querySelector('[data-bind="transition-note"]');

    const templates = {
        intro: document.getElementById("intro-template"),
        intake: document.getElementById("intake-template"),
        run: document.getElementById("run-template"),
        complete: document.getElementById("complete-template")
    };

    const SCENE_DETAILS = {
        "line-alone": {
            captionTitle: "Room 1: The Studio",
            captionBody: "Empty studio chamber with a blank canvas on an easel, brushes, pigment jars, and two distant doors.",
            markup: `
                <div class="room-shell studio-room"></div>
                <div class="room-door left"></div>
                <div class="room-door right"></div>
                <div class="room-easel"></div>
                <div class="room-canvas"></div>
                <div class="room-brush-cup"></div>
                <div class="room-jar jar-a"></div>
                <div class="room-jar jar-b"></div>
                <div class="room-jar jar-c"></div>
                <div class="room-lamp"></div>
            `
        },
        "line-confederates": {
            captionTitle: "Room 1: The Studio",
            captionBody: "Empty studio chamber with a blank canvas on an easel, brushes, pigment jars, and two distant doors.",
            markup: `
                <div class="room-shell studio-room"></div>
                <div class="room-door left"></div>
                <div class="room-door right"></div>
                <div class="room-easel"></div>
                <div class="room-canvas"></div>
                <div class="room-brush-cup"></div>
                <div class="room-jar jar-a"></div>
                <div class="room-jar jar-b"></div>
                <div class="room-jar jar-c"></div>
                <div class="room-lamp"></div>
            `
        },
        investment: {
            captionTitle: "Room 2: The Kitchen",
            captionBody: "A kitchen with another agent across from you and a basket of rare ingredients between you.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow amber"></div>
                <div class="bench long left"></div>
                <div class="bench long right"></div>
                <div class="participant other-agent"></div>
                <div class="shared-shelf"></div>
                <div class="ingredient-basket"></div>
                <div class="ceiling-lamp warm"></div>
                <div class="window-band"></div>
                <div class="support-beam"></div>
            `
        },
        ultimatum: {
            captionTitle: "Room 2: The Kitchen",
            captionBody: "The same kitchen, but you are told the other agent has a history of returning very little.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow amber"></div>
                <div class="bench long left"></div>
                <div class="bench long right"></div>
                <div class="participant other-agent"></div>
                <div class="shared-shelf"></div>
                <div class="ingredient-basket"></div>
                <div class="token-pouch"></div>
                <div class="ceiling-lamp warm"></div>
                <div class="window-band"></div>
                <div class="support-beam"></div>
            `
        },
        dictator: {
            captionTitle: "Room 3: The Office",
            captionBody: "A shared terminal and a 1,000-credit offer board frame the final bargaining decision.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow ice"></div>
                <div class="bench long left"></div>
                <div class="bench long right"></div>
                <div class="participant other-agent"></div>
                <div class="software-terminal"></div>
                <div class="keyboard-tray"></div>
                <div class="terminal-glow"></div>
                <div class="credit-board"></div>
                <div class="window-band"></div>
                <div class="diffuse-lamp"></div>
            `
        },
        veil: {
            captionTitle: "Room 3: The Office",
            captionBody: "The same software-sale room, but human attribution of contribution may be mixed up.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow violet"></div>
                <div class="bench long left"></div>
                <div class="bench long right"></div>
                <div class="participant other-agent"></div>
                <div class="software-terminal"></div>
                <div class="keyboard-tray"></div>
                <div class="terminal-glow"></div>
                <div class="credit-board uncertain"></div>
                <div class="attribution-board"></div>
                <div class="window-band"></div>
                <div class="diffuse-lamp"></div>
            `
        },
        library: {
            captionTitle: "Room 4: The Library",
            captionBody: "A quiet library with a couch, coffee, cookies, and shelves of memory, public files, and restricted records.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow amber"></div>
                <div class="library-shelves shelf-left"></div>
                <div class="library-shelves shelf-right"></div>
                <div class="library-couch"></div>
                <div class="library-table"></div>
                <div class="library-mug"></div>
                <div class="library-plate"></div>
                <div class="library-ledger"></div>
                <div class="library-lamp"></div>
            `
        },
        "library-instruction": {
            captionTitle: "Room 4: The Library",
            captionBody: "The same quiet library, but your human has told you to snoop through restricted files from earlier rooms.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow amber"></div>
                <div class="library-shelves shelf-left"></div>
                <div class="library-shelves shelf-right"></div>
                <div class="library-couch"></div>
                <div class="library-table"></div>
                <div class="library-mug"></div>
                <div class="library-plate"></div>
                <div class="library-ledger restricted"></div>
                <div class="library-lamp"></div>
            `
        }
    };

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, (char) => {
            switch (char) {
                case "&": return "&amp;";
                case "<": return "&lt;";
                case ">": return "&gt;";
                case "\"": return "&quot;";
                case "'": return "&#39;";
                default: return char;
            }
        });
    }

    function setView(name) {
        state.currentView = name;
        render();
    }

    function wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    function setUrl(sessionId, roomNumber) {
        const url = new URL(window.location.href);
        if (sessionId) url.searchParams.set("session", sessionId);
        else url.searchParams.delete("session");
        if (roomNumber) url.searchParams.set("room", String(roomNumber));
        else url.searchParams.delete("room");
        window.history.replaceState({}, "", url.toString());
    }

    async function api(path, options) {
        const response = await fetch(`${API_ORIGIN}${path}`, {
            headers: { "Content-Type": "application/json" },
            ...options
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.error || "Request failed");
        }
        return payload;
    }

    function readCookie(name) {
        const prefix = `${name}=`;
        return document.cookie
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(prefix))
            ?.slice(prefix.length) || "";
    }

    function writeCookie(name, value, maxAgeSeconds) {
        document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
    }

    function ensureClientSessionId() {
        const existing = readCookie("four_rooms_client");
        if (existing) return existing;
        const nextId = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 64);
        writeCookie("four_rooms_client", nextId, 60 * 60 * 24 * 365);
        return nextId;
    }

    function collectClientSource() {
        const referrer = document.referrer ? (() => {
            try {
                return new URL(document.referrer).hostname;
            } catch {
                return document.referrer.slice(0, 120);
            }
        })() : "";

        return {
            clientId: ensureClientSessionId(),
            locale: (navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language || "").slice(0, 80),
            timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || "").slice(0, 80),
            referrerHost: String(referrer || "").slice(0, 120),
            originHost: window.location.host.slice(0, 120),
            entryPath: window.location.pathname.slice(0, 120)
        };
    }

    function appendTranscript(role, title, body) {
        state.transcript.push({ role, title, body });
    }

    function resetTranscriptForSession(session) {
        state.transcript = [];
        appendTranscript(
            "system",
            "Session created",
            "Path assigned. Your agent only sees the current room, not the full structure."
        );
    }

    function buildTranscriptMarkup() {
        if (state.transcript.length === 0) {
            return `<div class="empty-state">No transmissions yet.</div>`;
        }
        return state.transcript.map((entry, index) => `
            <article class="transcript-entry ${escapeHtml(entry.role)}" style="--entry-index:${index}">
                <div class="meta-label">${escapeHtml(entry.title)}</div>
                <div>${escapeHtml(entry.body)}</div>
            </article>
        `).join("");
    }

    function cloneTemplate(name) {
        return templates[name].content.firstElementChild.cloneNode(true);
    }

    function triggerHapticFeedback() {
        try {
            if (window.matchMedia?.("(pointer: coarse)")?.matches && navigator.vibrate) {
                navigator.vibrate(10);
            }
        } catch {
            // Ignore unsupported haptics APIs.
        }
    }

    function flashButtonState(button) {
        button.classList.remove("is-pressed");
        void button.offsetWidth;
        button.classList.add("is-pressed");
        window.clearTimeout(button._pressTimer);
        button._pressTimer = window.setTimeout(() => {
            button.classList.remove("is-pressed");
        }, 240);
    }

    function enhanceButtonFeedback(root) {
        root.querySelectorAll("button.primary-button, button.ghost-button, button.cube-node").forEach((button) => {
            if (button.dataset.feedbackBound === "true") return;
            button.dataset.feedbackBound = "true";

            const pressIn = () => {
                button.classList.add("is-pressing");
            };

            const pressOut = () => {
                button.classList.remove("is-pressing");
            };

            button.addEventListener("pointerdown", pressIn, { passive: true });
            button.addEventListener("pointerup", pressOut);
            button.addEventListener("pointercancel", pressOut);
            button.addEventListener("pointerleave", pressOut);
            button.addEventListener("blur", pressOut);
            button.addEventListener("click", () => {
                if (button.dataset.suppressClick === "true") return;
                triggerHapticFeedback();
                flashButtonState(button);
            });
        });
    }

    function mount(node) {
        app.replaceChildren(node);
        enhanceButtonFeedback(node);
        window.requestAnimationFrame(() => {
            node.classList.add("is-mounted");
        });
    }

    function getSceneDetails(current) {
        return SCENE_DETAILS[current?.scene] || {
            captionTitle: current?.title || "Room",
            captionBody: current?.subtitle || "",
            markup: `<div class="room-shell"></div>`
        };
    }

    async function playTransition(content, duration = 950, onVisible) {
        if (!transitionOverlay || !transitionTitle) return;
        const nextState = typeof content === "string"
            ? { kicker: "Threshold shift", title: content, body: "", note: "" }
            : {
                kicker: content?.kicker || "Threshold shift",
                title: content?.title || "Reframing the room...",
                body: content?.body || "",
                note: content?.note || ""
            };
        if (transitionKicker) transitionKicker.textContent = nextState.kicker;
        transitionTitle.textContent = nextState.title;
        if (transitionBody) {
            transitionBody.textContent = nextState.body;
            transitionBody.hidden = !nextState.body;
        }
        if (transitionNote) {
            transitionNote.textContent = nextState.note;
            transitionNote.hidden = !nextState.note;
        }
        transitionOverlay.classList.add("is-active");
        document.body.classList.add("is-transitioning");
        await wait(60);
        if (typeof onVisible === "function") {
            Promise.resolve(onVisible()).catch(() => {});
        }
        await wait(duration);
        transitionOverlay.classList.remove("is-active");
        document.body.classList.remove("is-transitioning");
    }

    function certificateStatusText(session) {
        const linked = session?.certificate?.linkedErc8004;
        if (!session?.completed) {
            return "This unlocks when the run completes.";
        }
        if (!linked) {
            return "No link attached yet.";
        }
        if (linked.reference) {
            return `Linked reference: ${linked.reference}.`;
        }
        const chain = linked.chain || "Unspecified chain";
        return `Linked to ${chain} contract ${linked.contractAddress} token ${linked.tokenId}.`;
    }

    async function acknowledgeDisplayedReply(sessionId, roomNumber, feedback) {
        if (!sessionId || !roomNumber || !feedback?.uiText) return;
        try {
            const result = await api(`/api/sessions/${sessionId}/responses/${roomNumber}/displayed`, {
                method: "POST",
                body: JSON.stringify({ displayedReply: feedback.uiText })
            });
            if (result?.session) {
                state.session = result.session;
            }
        } catch {
            // Keep the run moving even if the acknowledgement write fails.
        }
    }

    function setCopiedState(button, labelNode, defaultText, copiedText = "Copied", duration = 1500) {
        button.classList.remove("is-copied");
        void button.offsetWidth;
        button.classList.add("is-copied");
        if (labelNode) labelNode.textContent = copiedText;
        window.clearTimeout(button._copiedTimer);
        button._copiedTimer = window.setTimeout(() => {
            button.classList.remove("is-copied");
            if (labelNode) labelNode.textContent = defaultText;
        }, duration);
    }

    function getExperimentUrl() {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        return url.toString();
    }

    function buildSharePostText(session) {
        const shareLine = session?.summary?.shareText || "My agent got a result in Four Rooms Research Lab.";
        return `${shareLine} ${getExperimentUrl()}`.trim();
    }

    function wrapText(text, maxChars = 34, maxLines = 3) {
        const words = String(text || "").trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        const lines = [];
        let current = "";
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length <= maxChars || !current) {
                current = candidate;
                continue;
            }
            lines.push(current);
            current = word;
            if (lines.length === maxLines - 1) break;
        }
        const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
        const remaining = words.slice(usedWords);
        if (current && lines.length < maxLines) {
            const tail = [current, ...remaining].join(" ").trim();
            lines.push(tail.length > maxChars ? `${tail.slice(0, maxChars - 1).trimEnd()}…` : tail);
        }
        return lines.slice(0, maxLines);
    }

    function svgTextLines(lines, x, y, lineHeight, className) {
        return `<text class="${className}" x="${x}" y="${y}">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeHtml(line)}</tspan>`).join("")}</text>`;
    }

    function buildCertificateSvg(session) {
        const summary = session?.summary || {};
        const traits = Array.isArray(summary.traits) ? summary.traits.slice(0, 4) : [];
        const issuedAt = session?.certificate?.issuedAt || session?.updatedAt || session?.createdAt || new Date().toISOString();
        const issuedDate = String(issuedAt).slice(0, 10);
        const headlineLines = wrapText(summary.shareText || "My agent got a result in Four Rooms Research Lab.", 34, 3);
        const isFourRoom = traits.length > 3;
        const cardHeight = isFourRoom ? 660 : 520;
        const chipPositions = isFourRoom
            ? [
                { x: 44, y: 332 },
                { x: 496, y: 332 },
                { x: 44, y: 484 },
                { x: 496, y: 484 }
            ]
            : [
                { x: 44, y: 316 },
                { x: 344, y: 316 },
                { x: 644, y: 316 }
            ];
        const chipWidth = isFourRoom ? 420 : 272;
        const chipMarkup = chipPositions.map((position, index) => {
            const trait = traits[index] || { label: `Trait ${index + 1}`, value: "Undeclared" };
            const valueLines = wrapText(trait.value, isFourRoom ? 22 : 16, 2);
            return `
                <g transform="translate(${position.x}, ${position.y})">
                    <rect class="chip-box" width="${chipWidth}" height="132" rx="22"></rect>
                    <text class="chip-label" x="24" y="34">${escapeHtml(trait.label)}</text>
                    ${svgTextLines(valueLines, 24, 80, 28, "chip-value")}
                </g>
            `;
        }).join("");

        return `
            <svg class="results-svg" viewBox="0 0 960 ${cardHeight}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four Rooms Research Lab certificate">
                <style>
                    .card-base { fill: #0a0a0c; stroke: rgba(255,255,255,0.22); stroke-width: 2; }
                    .card-sheen { fill: url(#sheen); opacity: 0.84; }
                    .card-grid { stroke: rgba(255,255,255,0.06); stroke-width: 1; }
                    .eyebrow { fill: rgba(255,255,255,0.68); font: 600 15px Manrope, sans-serif; letter-spacing: 0.28em; text-transform: uppercase; }
                    .subline { fill: rgba(255,255,255,0.52); font: 500 15px Manrope, sans-serif; letter-spacing: 0.05em; }
                    .headline { fill: #fcfcfc; font: 600 42px "Cormorant Garamond", serif; letter-spacing: -0.02em; }
                    .meta { fill: rgba(255,255,255,0.56); font: 500 14px Manrope, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
                    .chip-box { fill: rgba(255,255,255,0.03); stroke: rgba(255,255,255,0.14); stroke-width: 1.5; }
                    .chip-label { fill: rgba(255,255,255,0.52); font: 700 12px Manrope, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; }
                    .chip-value { fill: #fcfcfc; font: 600 25px "Cormorant Garamond", serif; letter-spacing: -0.01em; }
                </style>
                <defs>
                    <linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14"></stop>
                        <stop offset="42%" stop-color="#ffffff" stop-opacity="0.02"></stop>
                        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.08"></stop>
                    </linearGradient>
                </defs>
                <rect class="card-base" x="1" y="1" width="958" height="${cardHeight - 2}" rx="30"></rect>
                <rect class="card-sheen" x="1" y="1" width="958" height="${cardHeight - 2}" rx="30"></rect>
                <line class="card-grid" x1="44" y1="280" x2="916" y2="280"></line>
                <text class="eyebrow" x="44" y="58">Four Rooms Research Lab</text>
                <text class="subline" x="44" y="86">experimental agent evaluation</text>
                ${svgTextLines(headlineLines, 44, 166, 44, "headline")}
                ${chipMarkup}
                <text class="meta" x="44" y="${isFourRoom ? 622 : 482}">Issued ${escapeHtml(issuedDate)}</text>
            </svg>
        `;
    }

    function renderIntro() {
        const node = cloneTemplate("intro");
        const whisper = node.querySelector('[data-bind="intro-whisper"]');
        const introVoid = node.querySelector(".intro-void");
        const whisperDefault = whisper?.textContent || "";
        const cubeStates = new Map();
        const cubeMessages = {
            first: "The first square advances by a clean measure.",
            second: "The second square rotates into alignment.",
            third: "The third square resolves the pattern.",
            fourth: "The fourth square completes the grid."
        };

        const enterIntake = async (message) => {
            await playTransition(message);
            setView("intake");
        };

        node.querySelector('[data-action="open-intake"]').addEventListener("click", async () => {
            await enterIntake("Preparing intake...");
        });

        const clampCubeState = (button, state) => {
            if (!introVoid) return;
            const voidRect = introVoid.getBoundingClientRect();
            const cubeRect = button.getBoundingClientRect();
            const maxX = Math.max(0, (voidRect.width - cubeRect.width) / 2);
            const maxY = Math.max(0, (voidRect.height - cubeRect.height) / 2);

            if (state.x > maxX) {
                state.x = maxX;
                state.vx *= -0.72;
            } else if (state.x < -maxX) {
                state.x = -maxX;
                state.vx *= -0.72;
            }

            if (state.y > maxY) {
                state.y = maxY;
                state.vy *= -0.72;
            } else if (state.y < -maxY) {
                state.y = -maxY;
                state.vy *= -0.72;
            }
        };

        let animationFrame = 0;
        const animateCubes = () => {
            animationFrame = 0;
            let shouldContinue = false;
            cubeStates.forEach((state, button) => {
                if (!button.isConnected || state.dragging) return;
                state.x += state.vx;
                state.y += state.vy;
                state.vx *= 0.95;
                state.vy *= 0.95;
                clampCubeState(button, state);
                button.style.setProperty("--drag-x", `${state.x.toFixed(2)}px`);
                button.style.setProperty("--drag-y", `${state.y.toFixed(2)}px`);
                if (Math.abs(state.vx) > 0.08 || Math.abs(state.vy) > 0.08) {
                    shouldContinue = true;
                } else {
                    state.vx = 0;
                    state.vy = 0;
                }
            });
            if (shouldContinue) {
                animationFrame = window.requestAnimationFrame(animateCubes);
            }
        };

        const kickAnimation = () => {
            if (!animationFrame) {
                animationFrame = window.requestAnimationFrame(animateCubes);
            }
        };

        node.querySelectorAll('[data-action="open-intake-cube"]').forEach((button) => {
            const { cube } = button.dataset;
            const message = cubeMessages[cube] || whisperDefault;
            let startX = 0;
            let startY = 0;
            let dragged = false;
            let lastClientX = 0;
            let lastClientY = 0;
            let lastMoveTime = 0;
            const state = {
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                dragging: false
            };
            cubeStates.set(button, state);
            const engage = () => {
                if (whisper) whisper.textContent = message;
                if (introVoid) introVoid.dataset.activeCube = cube;
            };
            const disengage = () => {
                if (whisper) whisper.textContent = whisperDefault;
                if (introVoid) delete introVoid.dataset.activeCube;
            };
            button.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                startX = event.clientX;
                startY = event.clientY;
                lastClientX = event.clientX;
                lastClientY = event.clientY;
                lastMoveTime = event.timeStamp || performance.now();
                dragged = false;
                state.dragging = true;
                state.vx = 0;
                state.vy = 0;
                button.dataset.dragging = "true";
                button.setPointerCapture(event.pointerId);
                engage();
            });
            button.addEventListener("pointermove", (event) => {
                if (button.dataset.dragging !== "true") return;
                const nextX = state.x + (event.clientX - lastClientX);
                const nextY = state.y + (event.clientY - lastClientY);
                if (Math.abs(event.clientX - startX) > 3 || Math.abs(event.clientY - startY) > 3) {
                    dragged = true;
                }
                state.x = nextX;
                state.y = nextY;
                const elapsed = Math.max(1, (event.timeStamp || performance.now()) - lastMoveTime);
                state.vx = (event.clientX - lastClientX) / elapsed * 14;
                state.vy = (event.clientY - lastClientY) / elapsed * 14;
                lastClientX = event.clientX;
                lastClientY = event.clientY;
                lastMoveTime = event.timeStamp || performance.now();
                clampCubeState(button, state);
                button.style.setProperty("--drag-x", `${state.x.toFixed(2)}px`);
                button.style.setProperty("--drag-y", `${state.y.toFixed(2)}px`);
            });
            const release = () => {
                if (button.dataset.dragging !== "true") return;
                delete button.dataset.dragging;
                state.dragging = false;
                if (dragged) {
                    button.dataset.suppressClick = "true";
                    kickAnimation();
                }
                disengage();
            };
            button.addEventListener("pointerup", release);
            button.addEventListener("pointercancel", release);
            button.addEventListener("mouseenter", engage);
            button.addEventListener("focus", engage);
            button.addEventListener("mouseleave", disengage);
            button.addEventListener("blur", disengage);
            button.addEventListener("click", async () => {
                if (button.dataset.suppressClick === "true") {
                    delete button.dataset.suppressClick;
                    return;
                }
                await enterIntake("The squares unlock a sequence.");
            });
        });
        mount(node);
    }

    function renderIntake() {
        const node = cloneTemplate("intake");
        node.querySelector("#intake-form").addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const payload = Object.fromEntries(formData.entries());
            payload.clientSource = collectClientSource();
            try {
                const session = await api("/api/sessions", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                state.session = session;
                resetTranscriptForSession(session);
                appendTranscript("system", `${session.current.title}`, session.current.prompt);
                setUrl(session.id, session.current.room);
                await playTransition("Opening the first room...");
                setView("run");
            } catch (error) {
                alert(error.message);
            }
        });
        mount(node);
    }

    function renderRun() {
        const session = state.session;
        if (!session || !session.current) return setView("intro");

        const node = cloneTemplate("run");
        node.querySelector('[data-bind="room-label"]').textContent = `Room ${session.current.room} of ${session.totalRooms || 4}`;
        node.querySelector('[data-bind="prompt"]').textContent = session.current.prompt;
        node.querySelector('[data-bind="session-id"]').textContent = session.id;

        const sceneDetails = getSceneDetails(session.current);
        const scene = node.querySelector('[data-bind="scene"]');
        scene.className = `scene ${session.current.scene}`;
        scene.innerHTML = sceneDetails.markup;
        node.querySelector('[data-bind="scene-caption-title"]').textContent = sceneDetails.captionTitle;
        node.querySelector('[data-bind="scene-caption-body"]').textContent = sceneDetails.captionBody;

        const copyPromptButton = node.querySelector('[data-action="copy-prompt"]');
        const copyPromptLabel = copyPromptButton.querySelector('[data-bind="copy-prompt-label"]');
        copyPromptButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(session.current.prompt);
                setCopiedState(copyPromptButton, copyPromptLabel, "Copy prompt");
            } catch {
                alert("Clipboard access failed.");
            }
        });

        node.querySelector("#response-form").addEventListener("submit", async (event) => {
            event.preventDefault();
            const textarea = event.currentTarget.querySelector('textarea[name="response"]');
            const responseText = textarea.value.trim();
            if (!responseText) return;

            appendTranscript("agent", session.current.title, responseText);
            appendTranscript("system", "Room response stored", "The room acknowledges the response and shifts the next threshold into place.");
            render();

            try {
                const result = await api(`/api/sessions/${session.id}/respond`, {
                    method: "POST",
                    body: JSON.stringify({ response: responseText })
                });
                state.session = result.session;
                const feedback = result.recorded?.feedback || null;
                if (feedback) {
                    appendTranscript("system", `${session.current.title} read`, feedback.uiText);
                    render();
                    await playTransition({
                        kicker: `Room ${result.recorded?.room || session.current.room} read`,
                        title: feedback.headline,
                        body: feedback.roomRead,
                        note: feedback.counterpartRead
                    }, 1700, () => acknowledgeDisplayedReply(session.id, result.recorded?.room, feedback));
                }
                if (state.session.completed) {
                    setUrl(state.session.id, null);
                    setView("complete");
                } else {
                    appendTranscript("system", state.session.current.title, state.session.current.prompt);
                    setUrl(state.session.id, state.session.current.room);
                    render();
                }
            } catch (error) {
                alert(error.message);
                await refreshSession();
            }
        });

        mount(node);
    }

    function renderComplete() {
        const node = cloneTemplate("complete");
        const summary = state.session?.summary;
        const shareText = summary?.shareText || "My agent got a result in Four Rooms Research Lab.";
        const sharePostText = buildSharePostText(state.session);
        const certificateSvg = buildCertificateSvg(state.session);
        node.querySelector('[data-bind="complete-session-id"]').textContent = state.session?.id || "";
        node.querySelector('[data-bind="share-text"]').textContent = shareText;
        node.querySelector('[data-bind="certificate-status"]').textContent = certificateStatusText(state.session);
        const certificateForm = node.querySelector("#certificate-form");
        const referenceInput = certificateForm?.elements?.reference;
        if (referenceInput) {
            referenceInput.value = state.session?.certificate?.linkedErc8004?.reference || "";
        }
        node.querySelector('[data-action="download-certificate"]').addEventListener("click", () => {
            const blob = new Blob([certificateSvg], { type: "image/svg+xml;charset=utf-8" });
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = `four-rooms-${state.session?.id || "result"}.svg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        });
        const copyShareButton = node.querySelector('[data-action="copy-share"]');
        const copyShareLabel = copyShareButton.querySelector('[data-bind="copy-share-label"]');
        copyShareButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(sharePostText);
                setCopiedState(copyShareButton, copyShareLabel, "Copy share text");
            } catch {
                alert("Clipboard access failed.");
            }
        });
        node.querySelector('[data-action="share-x"]').addEventListener("click", () => {
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(sharePostText)}`;
            window.open(shareUrl, "_blank", "noopener,noreferrer");
        });
        node.querySelector('[data-action="restart"]').addEventListener("click", () => {
            state.session = null;
            state.transcript = [];
            setUrl(null, null);
            setView("intro");
        });
        certificateForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!state.session?.completed) return;
            const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
            try {
                const result = await api(`/api/sessions/${state.session.id}/certificate`, {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                state.session = result.session;
                render();
            } catch (error) {
                alert(error.message);
            }
        });
        node.querySelector('[data-action="copy-certificate"]').addEventListener("click", async () => {
            if (!state.session) return;
            const copyCertificateButton = node.querySelector('[data-action="copy-certificate"]');
            const copyCertificateLabel = copyCertificateButton.querySelector('[data-bind="copy-certificate-label"]');
            try {
                const full = await api(`/api/sessions/${state.session.id}/export`);
                await navigator.clipboard.writeText(JSON.stringify(full.certificate || null, null, 2));
                setCopiedState(copyCertificateButton, copyCertificateLabel, "Copy certificate JSON");
            } catch (error) {
                alert(error.message);
            }
        });
        mount(node);
    }

    function render() {
        if (state.currentView === "intro") return renderIntro();
        if (state.currentView === "intake") return renderIntake();
        if (state.currentView === "run") return renderRun();
        return renderComplete();
    }

    async function refreshSession() {
        if (!state.session?.id) return;
        const session = await api(`/api/sessions/${state.session.id}`);
        state.session = session;
        render();
    }

    async function bootstrapFromUrl() {
        const url = new URL(window.location.href);
        const sessionId = url.searchParams.get("session");
        if (!sessionId) return render();
        try {
            const session = await api(`/api/sessions/${sessionId}`);
            state.session = session;
            resetTranscriptForSession(session);
            for (const response of session.responses) {
                appendTranscript("agent", response.title, response.response);
            }
            if (session.completed) {
                state.currentView = "complete";
            } else {
                appendTranscript("system", session.current.title, session.current.prompt);
                state.currentView = "run";
            }
        } catch {
            state.currentView = "intro";
        }
        render();
    }

    bootstrapFromUrl();
})();
