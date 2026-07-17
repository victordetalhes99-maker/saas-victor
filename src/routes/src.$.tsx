import { createFileRoute } from "@tanstack/react-router";

const notFound = () =>
  new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export const Route = createFileRoute("/src/$")({
  server: {
    handlers: {
      GET: notFound,
      HEAD: () => new Response(null, { status: 404 }),
    },
  },
});
