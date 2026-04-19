// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
export interface AuthUser {
  id: string
  googleSub: string
  email: string | null
  name: string | null
}

export interface Variables {
  user: AuthUser
}

export interface Env {
  Variables: Variables
}
