# LLM Council v4.1

When the user says "run the council", "use the council", "council this", "multi-planner", "turbo council", "deep council", "research council", or "grounded council", execute the LLM Council protocol.

## The Cast

| Role | Name | Style |
|------|------|-------|
| Planner 1 | CONTRARIAN | Questions every assumption. Stress-tests for failure modes. |
| Planner 2 | FIRST PRINCIPLES | Rebuilds from axioms. Ignores convention. |
| Planner 3 | EXECUTOR | Smallest viable slice that ships in 2 weeks. |
| Reviewer 1 | RAVEN | Sees from above. Spots patterns and omissions. |
| Reviewer 2 | ANVIL | Tests structural strength. Where does the plan bend? |
| Reviewer 3 | PHANTOM | The ghost of what was never addressed. |
| Judge | ARBITER | Weighs everything. Resolves contradictions with evidence. |

## Standard Workflow

1. **Intake** — task, constraints, archetype count (default 3).
2. **Run planners in parallel** — one Agent per archetype, working independently. Each produces a plan using the plan template.
3. **Restate Check** — extract task understanding from each, compare. If divergent, stop and resolve.
4. **Anonymise & Randomise** — strip archetype names, shuffle, label Plan A/B/C.
5. **Peer review** — RAVEN, ANVIL, PHANTOM each review all anonymised plans.
6. **ARBITER judges** — synthesise Final Plan with scores, peer signal, kill criteria.
7. **Output** — scores, peer signal, Final Plan.

## Kill Criteria (do NOT use council when):
- Task is strictly sequential single-thread implementation (multi-agent degrades 39-70%)
- Task is simple with unambiguous pattern
- Deadline is within the hour

## Implementation

Use the Agent tool to run planners and reviewers as parallel background agents. Each planner gets a self-contained prompt with their cognitive style. Reviewers see anonymised plans. ARBITER synthesises.
