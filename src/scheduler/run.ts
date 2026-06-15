import type { CollectionResult } from "../types.js";
import { buildDefaultTasks, planTasks, readSchedulerState, writeTaskResult, type PlannedTask, type TaskId } from "./tasks.js";

type TaskRunOutput = {
  taskId: TaskId;
  status: "ok" | "error" | "skipped";
  startedAt?: string;
  finishedAt?: string;
  result?: CollectionResult | Record<string, unknown>;
  message?: string;
};

export type SchedulerRunOptions = {
  taskId?: TaskId;
  maxTasks?: number;
};

async function runTask(taskId: TaskId): Promise<CollectionResult | Record<string, unknown>> {
  if (taskId === "collect:hotspots") {
    const { collectHotspots } = await import("../collectors/hotspots.js");
    return collectHotspots();
  }
  if (taskId === "collect:subscriptions") {
    const { collectSubscriptions } = await import("../collectors/subscriptions.js");
    return collectSubscriptions();
  }
  if (taskId === "discover:bilibili-followings") {
    const { discoverBilibiliFollowings } = await import("../collectors/subscriptions.js");
    return discoverBilibiliFollowings();
  }
  if (taskId === "collect:subscriptions:followings") {
    const { collectFollowingSubscriptions } = await import("../collectors/subscriptions.js");
    return collectFollowingSubscriptions();
  }
  throw new Error(`Unknown task: ${taskId}`);
}

export async function schedulerPlan(): Promise<{ generatedAt: string; tasks: PlannedTask[] }> {
  const state = await readSchedulerState();
  return {
    generatedAt: new Date().toISOString(),
    tasks: planTasks(buildDefaultTasks(), state)
  };
}

export async function schedulerRunDue(options: SchedulerRunOptions = {}): Promise<{ generatedAt: string; stateRef?: string; runs: TaskRunOutput[] }> {
  const plan = await schedulerPlan();
  const runs: TaskRunOutput[] = [];
  let stateRef: string | undefined;
  let executed = 0;

  for (const task of plan.tasks) {
    if (options.taskId && task.id !== options.taskId) {
      runs.push({ taskId: task.id, status: "skipped", message: `Filtered by --task=${options.taskId}.` });
      continue;
    }

    if (!task.due) {
      runs.push({ taskId: task.id, status: "skipped", message: task.enabled ? "Not due yet." : task.reason ?? "Task disabled." });
      continue;
    }

    if (typeof options.maxTasks === "number" && executed >= options.maxTasks) {
      runs.push({ taskId: task.id, status: "skipped", message: `Limited by --max-tasks=${options.maxTasks}.` });
      continue;
    }

    const startedAt = new Date().toISOString();
    try {
      const result = await runTask(task.id);
      const finishedAt = new Date().toISOString();
      stateRef = await writeTaskResult(task.id, { startedAt, finishedAt, status: "ok" });
      runs.push({ taskId: task.id, status: "ok", startedAt, finishedAt, result });
      executed += 1;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      stateRef = await writeTaskResult(task.id, { startedAt, finishedAt, status: "error", message });
      runs.push({ taskId: task.id, status: "error", startedAt, finishedAt, message });
      executed += 1;
    }
  }

  return { generatedAt: plan.generatedAt, stateRef, runs };
}
