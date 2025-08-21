import { getRequests, addRequest } from './db.js';

export default async (request, context) => {
  if (request.method === "GET") {
    const rows = await getRequests();
    return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const saved = await addRequest({
      ...body,
      id: crypto.randomUUID(),
      status: "pending",
      timestamp: new Date().toISOString()
    });
    return new Response(JSON.stringify({ success: true, data: saved }), { status: 201 });
  }
};
