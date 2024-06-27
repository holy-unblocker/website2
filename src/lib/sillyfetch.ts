export async function sillyfetch(url: string, opts?: { signal: AbortSignal }) {
  const s = (await fetch("/api/sillyfetch", {
    method: "POST",
    body: url,
    signal: opts?.signal,
  })) as Response & { sillyurl: string };

  s.sillyurl = s.headers.get("x-url")!;

  return s;
}
