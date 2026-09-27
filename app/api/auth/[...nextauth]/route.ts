import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { db } from "@/lib/db"
import speakeasy from "speakeasy"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_client_secret"
    }),
    CredentialsProvider({
      name: "Development Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@vysify.com" },
        token2fa: { label: "2FA Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email) return null
        
        let user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (user && user.twoFactorEnabled) {
          if (!credentials.token2fa) {
             throw new Error("2FA_REQUIRED")
          }
          const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret!,
            encoding: "base32",
            token: credentials.token2fa,
            window: 1
          })
          if (!verified) throw new Error("INVALID_2FA")
        }

        if (!user) {
          const isAdmin = credentials.email.includes("admin@") || credentials.email.includes("andre@");
          user = await db.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split("@")[0],
              role: isAdmin ? "SUPERADMIN" : "USER",
              onboardingCompleted: false
            },
          })
          
          // Create default workspace and credit balance
          const workspace = await db.workspace.create({
            data: {
              name: `Workspace de ${user.name}`,
              creditBalance: {
                create: { balance: 100 } // 100 free credits
              }
            }
          })
          
          await db.workspaceMember.create({
            data: {
              userId: user.id,
              workspaceId: workspace.id,
              role: "OWNER"
            }
          })
        }
        
        return { 
          id: user.id, 
          email: user.email, 
          name: user.name,
          role: user.role,
          onboardingCompleted: user.onboardingCompleted
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google") {
        let dbUser = await db.user.findUnique({
          where: { email: user.email },
        })
        
        if (!dbUser) {
           dbUser = await db.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
              role: "USER",
              onboardingCompleted: false
            },
          })
          
          const workspace = await db.workspace.create({
            data: {
              name: `Workspace de ${dbUser.name}`,
              creditBalance: { create: { balance: 100 } }
            }
          })
          
          await db.workspaceMember.create({
            data: { userId: dbUser.id, workspaceId: workspace.id, role: "OWNER" }
          })
        }
      }
      return true
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.onboardingCompleted = token.onboardingCompleted;
      }
      return session
    },
    async jwt({ token, user, account, trigger, session }: any) {
      if (account?.provider === "google") {
         const dbUser = await db.user.findUnique({ where: { email: token.email as string }});
         if (dbUser) {
           token.sub = dbUser.id;
           token.role = dbUser.role;
           token.onboardingCompleted = dbUser.onboardingCompleted;
         }
      } else if (user) {
        token.role = user.role;
        token.onboardingCompleted = user.onboardingCompleted;
      }
      if (trigger === "update" && session?.onboardingCompleted !== undefined) {
        token.onboardingCompleted = session.onboardingCompleted;
      }
      return token
    }
  },
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
