import { createFileRoute } from "@tanstack/react-router";
import { verifyToken, parseAuthHeader } from "@/lib/auth";

export const Route = createFileRoute("/api/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get("Authorization");
        const token = parseAuthHeader(authHeader);

        if (!token) {
          return Response.json({ error: "No token provided" }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload) {
          return Response.json({ error: "Invalid or expired token" }, { status: 401 });
        }

        return Response.json({ valid: true, user: payload });
      },
    },
  },
});
