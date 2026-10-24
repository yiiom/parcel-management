import type { CurrentUser } from "./auth";

export function roleHome(role: CurrentUser["role"]) {
  return `/workspace/${role}`;
}
