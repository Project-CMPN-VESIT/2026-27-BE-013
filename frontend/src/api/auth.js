import { createInternalNeonAuth } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

const internalAuth = createInternalNeonAuth(authUrl, {
  adapter: BetterAuthReactAdapter(),
});

export const authClient = internalAuth.adapter;
export const getJWTToken = () => internalAuth.getJWTToken(false);
