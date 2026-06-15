import { describe, expect, it } from "vitest";
import { buildDefaultTasks, isTaskId, planTasks, type SchedulerState, type TaskDefinition } from "../src/scheduler/tasks.js";

const tasks: TaskDefinition[] = [
  {
    id: "collect:hotspots",
    description: "Hotspots",
    intervalMinutes: 15,
    enabled: true
  }
];

describe("scheduler planning", () => {
  it("marks enabled tasks without state as due", () => {
    const planned = planTasks(tasks, { tasks: {} }, new Date("2026-05-28T12:00:00.000Z"));
    expect(planned.find((task) => task.id === "collect:hotspots")?.due).toBe(true);
  });

  it("uses last finished time to calculate next run", () => {
    const state: SchedulerState = {
      tasks: {
        "collect:hotspots": { lastFinishedAt: "2026-05-28T11:50:00.000Z", lastStatus: "ok" }
      }
    };
    const planned = planTasks(tasks, state, new Date("2026-05-28T12:00:00.000Z"));
    const hotspots = planned.find((task) => task.id === "collect:hotspots");
    expect(hotspots?.due).toBe(false);
    expect(hotspots?.nextRunAt).toBe("2026-05-28T12:05:00.000Z");
  });

  it("validates task ids for CLI filters", () => {
    expect(isTaskId("collect:hotspots")).toBe(true);
    expect(isTaskId("collect:unknown")).toBe(false);
    expect(isTaskId(undefined)).toBe(false);
  });

  it("runs default non-browser collection hourly and does not add social API tasks", () => {
    const defaults = buildDefaultTasks();
    expect(defaults.find((task) => task.id === "collect:hotspots")?.intervalMinutes).toBe(60);
    expect(defaults.find((task) => task.id === "collect:subscriptions")?.intervalMinutes).toBe(60);
    expect(defaults.some((task) => task.id.includes("bilibili"))).toBe(false);
  });
});
