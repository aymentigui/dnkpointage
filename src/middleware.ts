import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { apiAuthPrefix, authRoutes, privateRoutes } from "./route";
import { NextResponse } from "next/server";
const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { cookies, nextUrl } = req;
  const isLogging = !!req.auth; // Vérifie si l'utilisateur est connecté

  let lang = cookies.get("lang")?.value || "fr";
  const supportedLanguages = ["en", "fr", "ar"];
  if (!supportedLanguages.includes(lang)) {
    lang = "fr"; // Langue par défaut si non valide
  }

  const isPrivateRoutes = privateRoutes.some((route) =>
    nextUrl.pathname.startsWith(route),
  );
  const isApiAuthRoutes = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isAuthRoutes = authRoutes.includes(nextUrl.pathname);

  const response = NextResponse.next();
  response.cookies.set("lang", lang);

  if (isApiAuthRoutes) {
    return response;
  }

  if (isAuthRoutes) {
    if (isLogging) {
      const domainUrl = process.env.DOMAIN_URL;
      console.log(domainUrl);

      if (!domainUrl) {
        console.log("DOMAIN_URL is not defined in the environment variables");
        throw new Error(
          "DOMAIN_URL is not defined in the environment variables",
        );
      }
      const response = NextResponse.redirect(`${domainUrl}/admin`);
      response.cookies.set("lang", lang);
      return response;
    }
    return response;
  }

  if (isPrivateRoutes && !isLogging) {
    const domainUrl = process.env.DOMAIN_URL;

    if (!domainUrl) {
      throw new Error("DOMAIN_URL is not defined in the environment variables");
    }
    const response = NextResponse.redirect(`${domainUrl}/auth/login`);
    response.cookies.set("lang", lang);
    return response;
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
  // '/((?!_next).*)' : Cette expression régulière fait correspondre toutes les routes
  // sauf celles sous le dossier _next (qui contient les ressources statiques et
  // générées par Next.js). Cela permet d'éviter d'appliquer le middleware aux
  //  fichiers générés automatiquement par Next.js,
  // comme les scripts JavaScript ou les fichiers CSS.
};
