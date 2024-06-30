import http from "node:http";

// returns whether the astro middleware should be executed
export function handleReq(
  req: http.IncomingMessage,
  res: http.OutgoingMessage
): boolean;
