import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
    },
  },
});
