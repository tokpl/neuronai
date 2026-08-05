// Demo stub — illustrates module layout for Cursor agents.
export function publish(stream, payload) {
  // ioredis XADD in real code
  return { stream, payload };
}
