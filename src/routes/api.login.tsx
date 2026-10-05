import { createFileRoute } from "@tanstack/react-router";
import { signToken, createSession } from "@/lib/auth";

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { email, password, role } = body;

        // In production, verify credentials against a database.
        // For this demo, any email/password pair is accepted.
        if (!email || !password) {
          return Response.json({ error: "Email and password required" }, { status: 400 });
        }

        const token = await signToken({
          userId: crypto.randomUUID(),
          email,
          role: role || "student",
        });

        const sessionId = createSession(crypto.randomUUID(), email, role || "student");

        return Response.json({ token, sessionId, user: { email, role: role || "student" } });
      },
    },
  },
});
