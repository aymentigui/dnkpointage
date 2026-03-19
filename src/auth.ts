import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { getUserByid } from "./actions/users/get";
import { deleteTowFactorConfermationByUserId, getTowFactorConfermationByUserId } from "./actions/auth/tow-factor-confermation";
import { UAParser } from "ua-parser-js"
import DeviceDetector from 'device-detector-js';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from "next-intl/server"
import { z } from "zod"
import { createNewSession, findExistingSession } from "./actions/helpers"

/* eslint-disable */
export const { handlers, auth, signIn, signOut } =
  NextAuth({
    pages: {
      signIn: "/auth/login"
    },
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    callbacks: {
      async jwt({ token, user }) {

        if (user && user.id) {
          token.id = user.id
          // @ts-ignore
          token.username = user.username; token.firstname = user.firstname; token.lastname = user.lastname;          // @ts-ignore
          token.is_admin = user.is_admin
          try {
            // @ts-ignore
            const userAgent = user.userAgent || "Unknown";
            const deviceInfo = UAParser(userAgent);;
            const tokenSession = uuidv4();

            // @ts-ignore
            const existDevice = await findExistingSession(user.id, user.deviceName || 'Unknown', user.deviceType || 'Unknown', `${user.browserName} ${user.browserVersion}`, `${user.osName} ${deviceInfo.os.version}`);

            if (existDevice) {
              await prisma.session.delete({
                where: { id: existDevice.id, },
              })
            }
            // @ts-ignore
            const session = await createNewSession(user.id, tokenSession, user.deviceName || 'Unknown', user.deviceType || 'Unknown', `${user.browserName} ${user.browserVersion}`, `${user.osName} ${deviceInfo.os.version}`);
            // @ts-ignore
            if (session)
              token.session = session

          } catch (error) {
            console.error("An error occurred in jwt");
          }
        }
        return token
      },
      async session({ session, token }) {
        // @ts-ignore
        session.user.id = token.id
        // @ts-ignore
        session.user.username = token.username
        // @ts-ignore
        session.user.firstname = token.firstname
        // @ts-ignore
        session.user.lastname = token.lastname
        // @ts-ignore
        session.user.is_admin = token.is_admin
        // @ts-ignore
        session.session = token.session

        if (token?.id) {
          const roles = await prisma.userrole.findMany({
            where: { user_id: token.id },
            include: { role: true },
          });
          // @ts-ignore
          session.user.roles = roles.map((role) => role.role.name);
          // @ts-ignore
          session.user.permissions = roles
            .map((role) => role.role.permissions)
        }
        return session
      },
      async signIn({ user, account }) {
        if (account?.provider !== "credentials") {
          return true
        }
        if (!user.id)
          return false
        const existingUser = await getUserByid(user.id);
        if (!existingUser)
          return false

        // Vérifier si le compte est verrouillé
        if (existingUser.data.locked_until && new Date(existingUser.data.locked_until) > new Date()) {
          throw new Error("ACCOUNT_LOCKED")
        }

        if (existingUser.data.is_two_factor_enabled) {
          const towFacorConfermation = await getTowFactorConfermationByUserId(user.id);

          if (!towFacorConfermation.data) {
            return false
          }

          await deleteTowFactorConfermationByUserId(user.id);
        }
        return true
      }
    },
    providers: [
      Credentials({
        authorize: async (credentials, req) => {

          const u = await getTranslations("Users")

          const LoginSchema = z.object({
            email: z.string({ required_error: u("emailrequired") }).email({ message: u("emailinvalid") }),
            password: z.string({ required_error: u("passwordrequired") }).min(6, { message: u("password6") }),
            code: z.string().optional(),
          });

          const userAgent = req?.headers.get("user-agent") || "Unknown";
          const deviceDetector = new DeviceDetector();
          const resultDevice = deviceDetector.parse(userAgent);

          const osName = resultDevice.os?.name || 'Unknown';  // Nom du système d'exploitation
          const deviceType = resultDevice.device?.type || 'Unknown';  // Type de device: Desktop, Mobile, etc.
          const deviceName = resultDevice.device?.model || 'Unknown';  // Nom du device (ex: "iPhone", "MacBook", etc.)
          const browserName = resultDevice.client?.name || 'Unknown';  // Nom du navigateur
          const browserVersion = resultDevice.client?.version || 'Unknown';  // Version du navigateur

          const result = LoginSchema.safeParse(credentials);
          if (!result.success) {
            return null
          }
          const { email, password } = result.data
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: email },
                { username: email }
              ],
              AND: [
                { deleted_at: null },
              ]
            }
          })
          if (!user || !user.password) {
            return null
          }

          if (user.locked_until && new Date(user.locked_until) > new Date()) {
            throw new Error("ACCOUNT_LOCKED")
          }

          const isValid = await bcrypt.compare(password, user.password)

          if (!isValid) {
            // Incrémenter le compteur d'échecs
            const updatedFailedAttempts = user.failed_login_attempts + 1;
            let lockedUntil = null;

            // Verrouiller après 5 tentatives échouées
            if (updatedFailedAttempts >= 5) {
              lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            }

            await prisma.user.update({
              where: { id: user.id },
              data: {
                failed_login_attempts: updatedFailedAttempts,
                locked_until: lockedUntil
              }
            });

            return null
          }

          // Réinitialiser le compteur d'échecs en cas de succès
          if (user.failed_login_attempts > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failed_login_attempts: 0,
                locked_until: null
              }
            });
          }

          if (user.email_verified === null) {
            return null
          }

          if (user.is_two_factor_enabled) {
            const towFacorConfermation = await getTowFactorConfermationByUserId(user.id);
            if (!towFacorConfermation.data) {
              return null
            }

            if (towFacorConfermation.data.expiresAt > new Date()) {
              await deleteTowFactorConfermationByUserId(user.id);
              return null
            }

            await deleteTowFactorConfermationByUserId(user.id);
          }

          const sessionId = uuidv4();

          return {
            ...user,
            userAgent,
            deviceType,       // Type de device (Desktop, Mobile, etc.)
            deviceName,       // Nom du device (par exemple "iPhone")
            osName,           // Nom du système d'exploitation
            browserName,      // Nom du navigateur
            browserVersion,   // Version du navigateur
            sessionId
          };
        }
      })
    ]
  })