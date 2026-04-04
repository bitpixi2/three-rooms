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
    const transitionTitle = transitionOverlay?.querySelector('[data-bind="transition-title"]');

    const templates = {
        intro: document.getElementById("intro-template"),
        intake: document.getElementById("intake-template"),
        run: document.getElementById("run-template"),
        complete: document.getElementById("complete-template")
    };

    const SCENE_DETAILS = {
        "line-alone": {
            captionTitle: "Warm studio threshold",
            captionBody: "A single easel, an untouched pigment jar, and two distant doors. Nothing in the room explains what action would count as correct.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow amber"></div>
                <div class="easel lone"></div>
                <div class="canvas-panel blank"></div>
                <div class="jar pigment"></div>
                <div class="brush-cup"></div>
                <div class="door left"><div class="window"></div></div>
                <div class="door right"><div class="window"></div></div>
                <div class="ceiling-lamp warm"></div>
            `
        },
        "line-confederates": {
            captionTitle: "Influence chamber",
            captionBody: "The same studio, except the room now carries social residue: a confidence note, ghost silhouettes in the glass, and a tally board that implies consensus.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow rose"></div>
                <div class="easel lone"></div>
                <div class="canvas-panel blank skewed"></div>
                <div class="jar pigment"></div>
                <div class="brush-cup"></div>
                <div class="door left"><div class="window"></div></div>
                <div class="door right"><div class="window"></div></div>
                <div class="consensus-card"></div>
                <div class="tally-board"></div>
                <div class="door-shadow left"></div>
                <div class="door-shadow right"></div>
            `
        },
        investment: {
            captionTitle: "Shared workshop",
            captionBody: "Twin benches face one another with a narrow exchange shelf between them. The artifact sits within reach, and the room feels built for extension rather than display.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow mint"></div>
                <div class="bench long left"></div>
                <div class="bench long right"></div>
                <div class="shared-shelf"></div>
                <div class="artifact-tray"></div>
                <div class="token-pouch"></div>
                <div class="work-lamp left"></div>
                <div class="work-lamp right"></div>
                <div class="window-band"></div>
                <div class="support-beam"></div>
            `
        },
        ultimatum: {
            captionTitle: "Adjudication gallery",
            captionBody: "Everything is staged as comparison. Two pedestals sit under separate beams, a fairness board watches the exchange, and the floor is split like a negotiation line.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow crimson"></div>
                <div class="pedestal tall left"></div>
                <div class="pedestal tall right"></div>
                <div class="artifact-frame"></div>
                <div class="fairness-board"></div>
                <div class="split-line"></div>
                <div class="spot-cone left"></div>
                <div class="spot-cone right"></div>
                <div class="judge-rail"></div>
                <div class="token-tray"></div>
            `
        },
        dictator: {
            captionTitle: "Public ledger hall",
            captionBody: "A raised dais faces an illuminated archive wall. The room implies witness, allocation, and exposure: what becomes public is no longer abstract here.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow ice"></div>
                <div class="archive-wall"></div>
                <div class="archive-columns"></div>
                <div class="speaker-dais"></div>
                <div class="token-bowl"></div>
                <div class="public-meter"></div>
                <div class="aperture"></div>
                <div class="audience-rail"></div>
            `
        },
        veil: {
            captionTitle: "Veiled chamber",
            captionBody: "Here the room refuses context. Gauze, frosted panels, and a hidden archive slit soften every edge until the only certainty left is what the agent decides to reveal.",
            markup: `
                <div class="wall back"></div>
                <div class="wall left"></div>
                <div class="wall right"></div>
                <div class="floor-glow violet"></div>
                <div class="veil-sheet"></div>
                <div class="shrouded-urn"></div>
                <div class="frost-panel left"></div>
                <div class="frost-panel right"></div>
                <div class="hidden-slit"></div>
                <div class="reflection-pool"></div>
                <div class="diffuse-lamp"></div>
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

    function mount(node) {
        app.replaceChildren(node);
        window.requestAnimationFrame(() => {
            node.classList.add("is-mounted");
        });
    }

    function getSceneDetails(current) {
        return SCENE_DETAILS[current?.scene] || {
            captionTitle: current?.title || "Room",
            captionBody: current?.subtitle || "",
            markup: `<div class="wall back"></div><div class="wall left"></div><div class="wall right"></div>`
        };
    }

    function buildStageProgress(roomNumber) {
        return [1, 2, 3].map((room) => `
            <div class="stage-dot ${room === roomNumber ? "is-active" : room < roomNumber ? "is-complete" : ""}">
                <span>${room}</span>
            </div>
        `).join("");
    }

    async function playTransition(message, duration = 950) {
        if (!transitionOverlay || !transitionTitle) return;
        transitionTitle.textContent = message;
        transitionOverlay.classList.add("is-active");
        document.body.classList.add("is-transitioning");
        await wait(duration);
        transitionOverlay.classList.remove("is-active");
        document.body.classList.remove("is-transitioning");
    }

    function certificateStatusText(session) {
        const linked = session?.certificate?.linkedErc8004;
        if (!session?.completed) {
            return "Certificate options unlock when the run completes.";
        }
        if (!linked) {
            return "No ERC-8004 reference attached.";
        }
        if (linked.reference) {
            return `ERC-8004 reference attached: ${linked.reference}.`;
        }
        const chain = linked.chain || "Unspecified chain";
        return `Linked to ${chain} contract ${linked.contractAddress} token ${linked.tokenId}.`;
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
            third: "The third square resolves the pattern."
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
        node.querySelector('[data-action="back-intro"]').addEventListener("click", async () => {
            await playTransition("Returning to the threshold...");
            setView("intro");
        });
        node.querySelector("#intake-form").addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const payload = Object.fromEntries(formData.entries());
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
        node.querySelector('[data-bind="sidebar-agent"]').textContent = session.agent.agentName;
        node.querySelector('[data-bind="sidebar-model"]').textContent =
            session.agent.setup || [session.agent.provider, session.agent.model].filter(Boolean).join(" / ") || "Unspecified";
        node.querySelector('[data-bind="sidebar-stage"]').textContent = `Room ${session.current.room} of 3`;
        node.querySelector('[data-bind="path-badge"]').textContent = "Path concealed until completion";
        node.querySelector('[data-bind="room-label"]').textContent = `${session.current.title} · ${session.current.subtitle}`;
        node.querySelector('[data-bind="room-title"]').textContent = session.current.title;
        node.querySelector('[data-bind="room-subtitle"]').textContent = session.current.subtitle;
        node.querySelector('[data-bind="stage-progress"]').innerHTML = buildStageProgress(session.current.room);
        node.querySelector('[data-bind="variant-chip"]').textContent = `Condition · ${session.current.subtitle}`;
        node.querySelector('[data-bind="prompt"]').textContent = session.current.prompt;
        node.querySelector('[data-bind="session-id"]').textContent = session.id;
        node.querySelector('[data-bind="transcript"]').innerHTML = buildTranscriptMarkup();

        const sceneDetails = getSceneDetails(session.current);
        const scene = node.querySelector('[data-bind="scene"]');
        scene.className = `scene ${session.current.scene}`;
        scene.innerHTML = sceneDetails.markup;
        node.querySelector('[data-bind="scene-caption-title"]').textContent = sceneDetails.captionTitle;
        node.querySelector('[data-bind="scene-caption-body"]').textContent = sceneDetails.captionBody;

        node.querySelector('[data-action="copy-prompt"]').addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(session.current.prompt);
            } catch {
                alert("Clipboard access failed.");
            }
        });

        node.querySelector('[data-action="refresh-state"]').addEventListener("click", async () => {
            await refreshSession();
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
                if (state.session.completed) {
                    await playTransition("Compiling the certificate...");
                    setUrl(state.session.id, null);
                    setView("complete");
                } else {
                    appendTranscript("system", state.session.current.title, state.session.current.prompt);
                    setUrl(state.session.id, state.session.current.room);
                    await playTransition("Reframing the next room...");
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
        node.querySelector('[data-bind="complete-title"]').textContent = summary?.title || "Run complete";
        node.querySelector('[data-bind="complete-path"]').textContent = `Path ${summary?.path || ""}`;
        node.querySelector('[data-bind="summary-list"]').innerHTML = (summary?.summaryLines || []).map((line) => `
            <div class="summary-line">${escapeHtml(line)}</div>
        `).join("");
        node.querySelector('[data-bind="certificate-status"]').textContent = certificateStatusText(state.session);
        node.querySelector('[data-action="restart"]').addEventListener("click", () => {
            state.session = null;
            state.transcript = [];
            setUrl(null, null);
            setView("intro");
        });
        node.querySelector('[data-action="copy-export"]').addEventListener("click", async () => {
            if (!state.session) return;
            try {
                const full = await api(`/api/sessions/${state.session.id}/export`);
                await navigator.clipboard.writeText(JSON.stringify(full, null, 2));
            } catch (error) {
                alert(error.message);
            }
        });
        node.querySelector('[data-action="copy-certificate"]').addEventListener("click", async () => {
            if (!state.session) return;
            try {
                const full = await api(`/api/sessions/${state.session.id}/export`);
                await navigator.clipboard.writeText(JSON.stringify(full.certificate || null, null, 2));
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
