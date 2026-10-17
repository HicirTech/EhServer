/**
 * The one configuration file (nfr.md OPS-1, ADR-0012): TOML, closed, and free of secrets. A proxy's
 * password comes from the environment variable the file names, never from the file itself.
 */
import { resolve } from "node:path";

import { checkSchema, type Resolve, type Schema } from "../contract/schema";

export type EgressConfig =
  | { readonly profile: "mock"; readonly url: string }
  | { readonly profile: `proxy:${string}`; readonly name: string; readonly url: URL };

export interface ServerConfig {
  /** Absolute: a relative one in the file is read from the file's own folder. */
  readonly dataDir: string;
  readonly listen: string | undefined;
  readonly port: number | undefined;
  readonly egress: EgressConfig;
}

export type ConfigReading =
  | { readonly kind: "valid"; readonly config: ServerConfig }
  | { readonly kind: "refused"; readonly problems: readonly string[] };

const ConfigSchema: Schema = {
  type: "object",
  required: ["data_dir", "egress"],
  properties: {
    data_dir: { type: "string", minLength: 1 },
    listen: { type: "string", minLength: 1 },
    port: { type: "integer", minimum: 0, maximum: 65535, description: "0 picks a free port" },
    egress: {
      type: "object",
      required: ["profile", "url"],
      properties: {
        profile: { type: "string", pattern: "^(mock|proxy:[a-z0-9][a-z0-9-]*)$" },
        url: { type: "string", minLength: 1 },
        password_env: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
      },
    },
  },
};

/** The shape ConfigSchema admits. */
interface ConfigFile {
  readonly data_dir: string;
  readonly listen?: string;
  readonly port?: number;
  readonly egress: {
    readonly profile: string;
    readonly url: string;
    readonly password_env?: string;
  };
}

const noReferences: Resolve = (ref) => {
  throw new Error(`the configuration schema has no $ref: ${ref}`);
};

export function readConfig(
  text: string,
  configDir: string,
  env: Readonly<Record<string, string | undefined>>,
): ConfigReading {
  let value: unknown;
  try {
    value = Bun.TOML.parse(text);
  } catch (error) {
    return refused(`not TOML: ${error instanceof Error ? error.message : String(error)}`);
  }

  const findings = checkSchema(ConfigSchema, value, noReferences);
  if (findings.length > 0) {
    return {
      kind: "refused",
      problems: findings.map(({ path, message }) => `${path}: ${message}`),
    };
  }

  const file = value as ConfigFile;
  const egress = egressConfig(file.egress, env);
  if (typeof egress === "string") {
    return refused(egress);
  }

  return {
    kind: "valid",
    config: {
      dataDir: resolve(configDir, file.data_dir),
      listen: file.listen,
      port: file.port,
      egress,
    },
  };
}

/** The egress the file names, or why it may not be used. Never repeats the URL. */
function egressConfig(
  egress: ConfigFile["egress"],
  env: Readonly<Record<string, string | undefined>>,
): EgressConfig | string {
  const url = URL.parse(egress.url);
  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return "$.egress.url: not an http:// or https:// URL";
  }

  if (egress.profile === "mock") {
    return egress.password_env === undefined
      ? { profile: "mock", url: egress.url }
      : "$.egress.password_env: only a proxy takes a password";
  }

  if (url.password !== "") {
    return "$.egress.url: holds a password; name the variable that holds it in password_env instead";
  }

  if (egress.password_env !== undefined) {
    const password = env[egress.password_env] ?? "";
    if (password === "") {
      return `$.egress.password_env: ${egress.password_env} is not set`;
    }

    if (url.username === "") {
      return "$.egress.url: needs the user name before @ when a password is given";
    }

    url.password = password;
  }

  const name = egress.profile.slice("proxy:".length);
  return { profile: `proxy:${name}`, name, url };
}

function refused(problem: string): ConfigReading {
  return { kind: "refused", problems: [problem] };
}
