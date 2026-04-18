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
