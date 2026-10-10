/** Serves the mock on a fixed port for manual use: `bun mock/main.ts --port 7878`. */
import { parseArgs } from "node:util";

import { startMock } from "./server";

const DefaultPort = 7878;

if (import.meta.main) {
  const { values } = parseArgs({ args: Bun.argv.slice(2), options: { port: { type: "string" } } });
  const mock = startMock(Number(values.port ?? DefaultPort));
  console.log(`mock: ${mock.url}/e-hentai.org/ and ${mock.url}/exhentai.org/`);
}
