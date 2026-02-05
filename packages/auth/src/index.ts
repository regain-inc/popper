// Server-side auth

export type { AuthClient } from './client';
// Client-side auth
export { authClient, signIn, signOut, signUp, useSession } from './client';
export type { Auth, SignUpUser } from './server';
export { auth, registerLogoutCallback, registerUserCreatedCallback } from './server';
