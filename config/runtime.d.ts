import http from "node:http";

export function handleReq(
  req: http.IncomingMessage,
  res: http.OutgoingMessage,
  middleware: () => void
);
