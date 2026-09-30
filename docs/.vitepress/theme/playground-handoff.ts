import type { PlaygroundHandoff } from "./playground";

let pendingHandoff: PlaygroundHandoff | undefined;

export function savePlaygroundHandoff(handoff: PlaygroundHandoff): void {
  pendingHandoff = Object.freeze({ ...handoff });
}

export function takePlaygroundHandoff(): PlaygroundHandoff | undefined {
  const handoff = pendingHandoff;
  pendingHandoff = undefined;

  return handoff;
}
