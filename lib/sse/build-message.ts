export function buildSseMessage<T>(event: T) {
  return `data: ${JSON.stringify(event)}\n\n`;
}
