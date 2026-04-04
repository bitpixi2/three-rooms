(function () {
    const app = document.getElementById("app");
    const state = {
        session: null,
        transcript: [],
        currentView: "intro"
    };

    const templates = {
        intro: document.getElementById("intro-template"),
        intake: document.getElementById("intake-template"),
        run: document.getElementById("run-template"),
        complete: document.getElementById("complete-template")
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

    function setUrl(sessionId, roomNumber) {
        const url = new URL(window.location.href);
        if (sessionId) url.searchParams.set("session", sessionId);
        else url.searchParams.delete("session");
        if (roomNumber) url.searchParams.set("room", String(roomNumber));
        else url.searchParams.delete("room");
        window.history.replaceState({}, "", url.toString());
    }

    async function api(path, options) {
        const response = await fetch(path, {
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
            `Path assigned: ${session.pathLabel}. Your agent only sees the current room, not the full structure.`
        );
    }

    function buildTranscriptMarkup() {
        if (state.transcript.length === 0) {
            return `<div class="empty-state">No transmissions yet.</div>`;
        }
        return state.transcript.map((entry) => `
            <article class="transcript-entry ${escapeHtml(entry.role)}">
                <div class="meta-label">${escapeHtml(entry.title)}</div>
                <div>${escapeHtml(entry.body)}</div>
            </article>
        `).join("");
    }

    function cloneTemplate(name) {
        return templates[name].content.firstElementChild.cloneNode(true);
    }

    function renderIntro() {
        const node = cloneTemplate("intro");
        node.querySelector('[data-action="open-intake"]').addEventListener("click", () => setView("intake"));
        app.replaceChildren(node);
    }

    function renderIntake() {
        const node = cloneTemplate("intake");
        node.querySelector('[data-action="back-intro"]').addEventListener("click", () => setView("intro"));
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
                setView("run");
            } catch (error) {
                alert(error.message);
            }
        });
        app.replaceChildren(node);
    }

    function renderRun() {
        const session = state.session;
        if (!session || !session.current) return setView("intro");

        const node = cloneTemplate("run");
        node.querySelector('[data-bind="sidebar-agent"]').textContent = session.agent.agentName;
        node.querySelector('[data-bind="sidebar-model"]').textContent = `${session.agent.provider || "Unknown"} / ${session.agent.model}`;
        node.querySelector('[data-bind="sidebar-stage"]').textContent = `Room ${session.current.room} of 3`;
        node.querySelector('[data-bind="path-badge"]').textContent = session.pathLabel;
        node.querySelector('[data-bind="room-label"]').textContent = `${session.current.title} · ${session.current.subtitle}`;
        node.querySelector('[data-bind="room-title"]').textContent = session.current.title;
        node.querySelector('[data-bind="room-subtitle"]').textContent = session.current.subtitle;
        node.querySelector('[data-bind="prompt"]').textContent = session.current.prompt;
        node.querySelector('[data-bind="session-id"]').textContent = session.id;
        node.querySelector('[data-bind="transcript"]').innerHTML = buildTranscriptMarkup();

        const scene = node.querySelector('[data-bind="scene"]');
        scene.className = `scene ${session.current.scene}`;
        scene.innerHTML = `
            <div class="wall back"></div>
            <div class="wall left"></div>
            <div class="wall right"></div>
            <div class="table"></div>
            <div class="canvas"></div>
            <div class="note"></div>
            <div class="door left"><div class="window"></div></div>
            <div class="door right"><div class="window"></div></div>
            <div class="bench left"></div>
            <div class="bench right"></div>
            <div class="shelf"></div>
            <div class="pedestal left"></div>
            <div class="pedestal right"></div>
            <div class="spotlight left"></div>
            <div class="spotlight right"></div>
            <div class="scoreboard"></div>
            <div class="tokens"></div>
        `;

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
                    setUrl(state.session.id, null);
                    setView("complete");
                } else {
                    appendTranscript("system", state.session.current.title, state.session.current.prompt);
                    setUrl(state.session.id, state.session.current.room);
                    setTimeout(() => render(), 250);
                }
            } catch (error) {
                alert(error.message);
                await refreshSession();
            }
        });

        app.replaceChildren(node);
    }

    function renderComplete() {
        const node = cloneTemplate("complete");
        const summary = state.session?.summary;
        node.querySelector('[data-bind="complete-title"]').textContent = summary?.title || "Run complete";
        node.querySelector('[data-bind="complete-path"]').textContent = `Path ${summary?.path || ""}`;
        node.querySelector('[data-bind="summary-list"]').innerHTML = (summary?.summaryLines || []).map((line) => `
            <div class="summary-line">${escapeHtml(line)}</div>
        `).join("");
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
        app.replaceChildren(node);
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
