import { createFileRoute } from "@tanstack/react-router";
import { deleteSession } from "@/lib/auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { sessionId } = body;

        if (sessionId) {
          deleteSession(sessionId);
        }

        return Response.json({ success: true });
      },
    },
  },
});
