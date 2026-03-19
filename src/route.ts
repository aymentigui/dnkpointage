export const privateRoutes = ["/admin", "/workspaces"];

export const authRoutes = ["/auth/login", "/auth/register"];
export const apiAuthPrefix = "/api/auth";

export const publicRoutes = ["/api"];
export const dynamicPublicRoutes = [
  /^\/blog\/[\w-]+$/, // Route dynamique publique pour /blog/[id] ou /blog/[slug]
  /^\/formations\/[\w-]+$/, // Route dynamique publique pour /formations/[id] ou /formations/[slug]
  /^\/events\/[\w-]+$/, // Route dynamique publique pour /events/[slug]
  // w+ : Aa09-_
];
