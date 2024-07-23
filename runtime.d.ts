import http from "node:http";
import stream from "node:stream";

export function handleReq(
  req: http.IncomingMessage,
  res: http.OutgoingMessage,
  middleware: () => void,
);

export function handleUpgrade(
  req: http.IncomingMessage,
  socket: stream.Duplex,
  head: Buffer,
);
