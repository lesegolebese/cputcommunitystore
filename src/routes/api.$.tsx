import { createFileRoute } from "@tanstack/react-router";

// Catch-all for every /api/* endpoint (auth, products, orders, payments, ...).
// Routing lives in src/server/handlers.ts so it can be unit-tested without a server.
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
      POST: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
      PUT: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
      PATCH: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
      DELETE: async ({ request }) => (await import("@/server/handlers")).handleApi(request),
    },
  },
});
