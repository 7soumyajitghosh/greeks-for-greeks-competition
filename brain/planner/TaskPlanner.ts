import type { SubTask, TaskPlan } from "../core/types";

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

const DECOMPOSITION_RULES: Array<{ match: RegExp; steps: string[] }> = [
  { match: /auth/i, steps: ["Design auth model (sessions/JWT/OAuth)", "Implement signup/login/logout", "Add session middleware + protected routes", "Add auth tests"] },
  { match: /database|db\b/i, steps: ["Design schema + migrations", "Set up DB client/ORM", "Implement repositories", "Seed + test queries"] },
  { match: /model rout|ai gateway|llm/i, steps: ["Define provider abstraction", "Implement router (capability/cost/latency)", "Add fallback + retries", "Add token/cost tracking"] },
  { match: /deploy/i, steps: ["Containerize / build config", "Set up environment variables + secrets", "Deploy + smoke test", "Add monitoring/logging"] },
  { match: /frontend|website|ui\b/i, steps: ["Define IA + routes", "Build layout + components", "Wire API integration", "Responsive + a11y pass"] },
  { match: /test/i, steps: ["Write unit tests", "Write integration tests", "Run + fix failures"] },
];

export class TaskPlanner {
  plan(goal: string, complexity: "simple" | "medium" | "complex"): TaskPlan {
    if (complexity === "simple") {
      return {
        id: uid("plan"), goal, createdAt: Date.now(),
        subtasks: [{ id: uid("sub"), title: goal.slice(0, 80), description: goal, priority: 1, dependencies: [], parallelizable: false, status: "pending", attempts: 0, maxRetries: 2 }],
      };
    }
    const steps: string[] = [];
    for (const rule of DECOMPOSITION_RULES) {
      if (rule.match.test(goal)) steps.push(...rule.steps);
    }
    if (!steps.length) {
      steps.push(
        "Clarify requirements + acceptance criteria",
        "Design approach",
        "Implement core solution",
        "Verify + handle edge cases",
        "Summarize result",
      );
    }
    const unique = [...new Set(steps)].slice(0, 10);
    const subtasks: SubTask[] = unique.map((title, i) => ({
      id: uid("sub"),
      title,
      description: `${title} (part of: ${goal.slice(0, 100)})`,
      priority: i + 1,
      dependencies: i === 0 ? [] : [],
      parallelizable: /test|research|design|document/i.test(title),
      status: "pending",
      attempts: 0,
      maxRetries: 2,
    }));
    // chain non-parallelizable tasks sequentially
    let prev: string | null = null;
    for (const s of subtasks) {
      if (!s.parallelizable && prev) s.dependencies = [prev];
      if (!s.parallelizable) prev = s.id;
    }
    return { id: uid("plan"), goal, createdAt: Date.now(), subtasks };
  }

  readySubtasks(plan: TaskPlan): SubTask[] {
    const done = new Set(plan.subtasks.filter((s) => s.status === "succeeded" || s.status === "skipped").map((s) => s.id));
    return plan.subtasks
      .filter((s) => s.status === "pending" || (s.status === "failed" && s.attempts <= s.maxRetries))
      .filter((s) => s.dependencies.every((d) => done.has(d)))
      .sort((a, b) => a.priority - b.priority);
  }

  markResult(plan: TaskPlan, subtaskId: string, ok: boolean, result?: unknown, error?: string): TaskPlan {
    return {
      ...plan,
      subtasks: plan.subtasks.map((s) =>
        s.id === subtaskId
          ? { ...s, status: ok ? "succeeded" : "failed", attempts: s.attempts + 1, result, error }
          : s,
      ),
    };
  }

  isComplete(plan: TaskPlan): boolean {
    return plan.subtasks.every((s) => s.status === "succeeded" || s.status === "skipped");
  }

  progress(plan: TaskPlan): number {
    if (!plan.subtasks.length) return 1;
    return plan.subtasks.filter((s) => s.status === "succeeded").length / plan.subtasks.length;
  }
}
