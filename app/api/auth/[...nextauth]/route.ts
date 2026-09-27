import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Development Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@vysify.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null
        
        let user = await db.user.findUnique({
          where: { email: credentials.email },
        })

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
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.onboardingCompleted = token.onboardingCompleted;
      }
      return session
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.onboardingCompleted = user.onboardingCompleted;
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
