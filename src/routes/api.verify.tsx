import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
    },
  },
});
