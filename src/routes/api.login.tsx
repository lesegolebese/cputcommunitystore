import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
    },
  },
});
