import { get, set } from "idb-keyval";

const KEY_TASKS = "rh-cockpit-task-states";

// Task state structure:
// { [taskId]: { status: "open"|"done"|"snoozed", snoozedUntil, completedAt, notes } }

export async function loadTaskStates() {
  return (await get(KEY_TASKS)) || {};
}

export async function saveTaskStates(states) {
  await set(KEY_TASKS, states);
}

export function markDone(states, taskId) {
  return { ...states, [taskId]: { ...states[taskId], status: "done", completedAt: new Date().toISOString() } };
}

export function markOpen(states, taskId) {
  const next = { ...states };
  delete next[taskId];
  return next;
}

export function snoozeTask(states, taskId, days) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return { ...states, [taskId]: { ...states[taskId], status: "snoozed", snoozedUntil: until.toISOString() } };
}

export function addNote(states, taskId, note) {
  return { ...states, [taskId]: { ...states[taskId], notes: note } };
}

// Check if a snoozed task should reappear
export function isVisible(state) {
  if (!state) return true;
  if (state.status === "done") return false;
  if (state.status === "snoozed" && state.snoozedUntil) {
    return new Date() >= new Date(state.snoozedUntil);
  }
  return true;
}
