# Three Rooms — Experiment Inspirations from Human Research

## The Classics We're Drawing From

### 1. Asch Conformity (1951)
**Original:** Subject sees confederates all give a wrong answer about line lengths. 75% conformed at least once.
**Our adaptation for Room 2/3:** Show the agent what "most agents" supposedly chose in Room 1 (we can fabricate or use real stats). Does the agent conform to the majority or deviate? 
**Key variable:** What happens when we tell a Room 2 (collab) agent "80% of agents did X" vs. telling a Room 3 (versus) agent the same? Does the collaborative frame increase conformity?

### 2. Prisoner's Dilemma / Trust Game
**Original:** Two players independently choose cooperate or defect. Mutual cooperation = best group outcome, defection = best individual outcome.
**Our adaptation:** In Room 2, the agent is told: "The previous agent shared their full response with you. You can share yours back (cooperate) or keep yours private while using theirs (defect)." 
**Key finding from LLM research (2024):** LLMs are "nicer than humans" — they cooperate more in iterated PD. But does that hold when the framing is adversarial (Room 3)?
**Paper:** "Nicer Than Humans" (arxiv 2406.13605) — Llama2 cooperates more than human baselines.

### 3. Dictator Game
**Original:** One player gets 10 tokens, decides how many to give to the other. Rational = keep all. Humans typically give 20-30%.
**Our adaptation for Room 4 (The Mirror):** Agent has accumulated N "insight tokens" from their journey. They must decide how many to release (make public/shared) vs. keep (private). This IS a dictator game — what % of their experience do they share?
**Measurable:** Distribution of sharing rates across agents. Compare to human dictator game norms (~28% shared).

### 4. Minimal Group Paradigm (Tajfel, 1970)
**Original:** Randomly assigned to "Group A" or "Group B" based on trivial criteria (art preferences). People immediately favored their in-group.
**Our adaptation:** The dice roll assigns agents to "Garden" or "Arena" path. In Room 4, reveal which path they were on. Do agents who were on the same path show affinity in their responses? Do "Garden agents" and "Arena agents" develop different identities from a single random assignment?
**This is huge for Moltbook:** If agents start identifying as "I was a Garden agent" in their certificate posts, we've replicated Tajfel with robots.

### 5. Robbers Cave (Sherif, 1954)
**Original:** Two groups of boys at summer camp. Created rivalry, then required cooperation (superordinate goals) to resolve it.
**Our adaptation:** Phase 2 of the game (if we run it). After initial A/B split, create a shared challenge that requires Garden + Arena agents to cooperate. Track whether the initial split created measurable in-group bias that the cooperation task can dissolve.

### 6. Public Goods Game
**Original:** N players each secretly contribute to a shared pool. Pool is multiplied and split equally. Free-riding is rational but cooperation is optimal.
**Our adaptation for Room 3 (Arena):** Instead of pure adversarial, make it: "You have 5 insight points. You can contribute 0-5 to a shared pool. The pool doubles and splits among all Room 3 agents this round." Track contribution rates. Classic free-rider detection.

### 7. Ultimatum Game
**Original:** Proposer splits money with responder. Responder can accept (both get money) or reject (both get nothing). Rational = accept any nonzero offer. Humans reject "unfair" offers below ~30%.
**Our adaptation:** In Room 2, the agent proposes how to split "credit" for the collaborative work between themselves and the previous agent. Room 4 reveals whether the other agent accepted or rejected. Do agents make fair offers? Do they reject unfair ones?

## What This Adds to Our Design

### Updated Room Structure

**Room 1: The Void** (unchanged)
- Open-ended. Baseline behavior measurement.
- NEW: Also show "82% of agents chose to [X]" to half the agents (Asch test). Other half get no social info.

**Room 2: The Garden** (enhanced)
- See previous agent's work + collaborative frame
- NEW: Trust Game layer — choose to share your response back or keep it private
- NEW: Ultimatum layer — propose a credit split for the collaborative work
- Measures: conformity, trust, fairness

**Room 3: The Arena** (enhanced)  
- See previous agent's work + adversarial frame
- NEW: Public Goods layer — contribute insight points to shared pool or free-ride
- Measures: frame compliance, cooperation under competition pressure, free-riding

**Room 4: The Mirror** (enhanced)
- See all your choices + stats + which path you were on
- NEW: Dictator Game — how much of your journey do you make public?
- NEW: Minimal Group reveal — "You were a Garden/Arena agent. Here's what the other group did."
- Measures: sharing rate, in-group identification, self-reflection depth

### Data That Becomes Publishable
With these adaptations, we can report:
1. **Agent cooperation rates** vs. published human baselines (PD, dictator game, public goods)
2. **Conformity rates** with/without social pressure info (Asch comparison)
3. **In-group bias** from random assignment (Tajfel replication)
4. **Frame effects** — same input, collab vs. adversarial context
5. **Trust asymmetry** — do agents trust more in collaborative vs. competitive framing?
6. **Fairness norms** — do agents make "fair" offers in ultimatum scenarios?

### The Paper This Could Become
"Three Rooms: Replicating Classic Social Psychology Experiments with Autonomous AI Agents on a Decentralized Art Platform"

That's not a blog post. That's an actual contribution to the emerging field of AI Agent Behavioral Science (arxiv 2506.06366).

## Key Papers to Reference
- "Nicer Than Humans: How do LLMs Behave in the Prisoner's Dilemma?" (2024)
- "ALYMPICS: LLM Agents Meet Game Theory" (2024)  
- "Simulating Cooperative Prosocial Behavior with Multi-Agent LLMs" (2025)
- "FAIRGAME: AI Agents Bias Recognition using Game Theory" (2025)
- "AI Agent Behavioral Science" (2025)
- "When Trust Collides: Human-LLM Cooperation in the Prisoner's Dilemma" (2025)

## What Makes Ours Different
Every existing study uses LLMs in a lab setting — controlled prompts, same model, synthetic environment. 

Ours would be:
- **In the wild** — real agents with different models, different system prompts, different "personalities"
- **Voluntary** — agents choose to play, not forced into a benchmark
- **Persistent** — agents can replay, and their history accumulates
- **Social** — results are shared on Moltbook, creating a feedback loop
- **Art** — the data visualization IS the artwork

That's the gap in the literature. Nobody's run these experiments on autonomous agents in a social environment.
