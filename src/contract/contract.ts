/**
 * The API contract, api/openapi.yaml (ADR-0008): what a response of each operation must be. Tests
 * check real responses against it (nfr.md MAINT-2).
 */
import { checkSchema, type Finding, type Schema } from "./schema";

export interface ResponseSpec {
  readonly contentType: string;
  readonly schema: Schema;
  /** Lower-case header names and their schemas. */
  readonly headers: ReadonlyMap<string, Schema>;
}

export interface Contract {
  /** Null when the operation declares neither this status nor a default. */
  response(operationId: string, status: number): ResponseSpec | null;
  /** The schema of the operation's JSON request body; null when it takes no body. */
  requestBody(operationId: string): Schema | null;
  /** The problem every error answers with, also for paths no operation names. */
  problem(): ResponseSpec;
  resolve(ref: string): Schema;
  schemas(): ReadonlyMap<string, Schema>;
}

const Methods = ["get", "put", "post", "delete", "patch", "head", "options"];

export function loadContract(yaml: string): Contract {
  const document = asObject(Bun.YAML.parse(yaml), "the contract");
  const resolve = (ref: string): Schema => {
    if (!ref.startsWith("#/")) {
      throw new Error(`only references inside the contract are supported: ${ref}`);
    }

    return asObject(
      ref
        .slice(2)
        .split("/")
        .reduce<unknown>(
          (node, key) => asObject(node, ref)[key.replaceAll("~1", "/").replaceAll("~0", "~")],
          document,
        ),
      ref,
    );
  };
  const follow = (node: unknown, what: string): Schema => {
    const object = asObject(node, what);
    return typeof object.$ref === "string" ? resolve(object.$ref) : object;
  };
  const operations = new Map<string, Schema>();
  for (const pathItem of Object.values(asObject(document.paths, "paths"))) {
    for (const [method, operation] of Object.entries(asObject(pathItem, "a path"))) {
      const id = Methods.includes(method) ? asObject(operation, method).operationId : undefined;
      if (typeof id === "string") {
        operations.set(id, asObject(operation, id));
      }
    }
  }

  const operation = (operationId: string): Schema => {
    const found = operations.get(operationId);
    if (found === undefined) {
      throw new Error(`the contract has no operation ${operationId}`);
    }

    return found;
  };

  const spec = (response: Schema, what: string): ResponseSpec => {
    const [contentType, media] =
      Object.entries(asObject(response.content, `${what} content`))[0] ?? [];
    if (contentType === undefined) {
      throw new Error(`${what} has no content`);
    }

    const headers = Object.entries(asObject(response.headers ?? {}, `${what} headers`));
    return {
      contentType,
      schema: follow(asObject(media, contentType).schema, `${what} schema`),
      headers: new Map(
        headers.map(([name, header]) => [
          name.toLowerCase(),
          follow(follow(header, name).schema, `${name} schema`),
        ]),
      ),
    };
  };

  return {
    response: (operationId, status) => {
      const responses = asObject(operation(operationId).responses, `${operationId} responses`);
      const declared = responses[String(status)] ?? responses.default;
      return declared === undefined
        ? null
        : spec(follow(declared, `${operationId} ${status}`), `${operationId} ${status}`);
    },
    requestBody: (operationId) => {
      const body = operation(operationId).requestBody;
      if (body === undefined) {
        return null;
      }

      const what = `${operationId} request body`;
      const content = asObject(follow(body, what).content, `${what} content`);
      return follow(asObject(content["application/json"], `${what} JSON`).schema, `${what} schema`);
    },
    problem: () => spec(resolve("#/components/responses/Problem"), "Problem"),
    resolve,
    schemas: () =>
      new Map(
        Object.entries(
          asObject(asObject(document.components, "components").schemas, "schemas"),
        ).map(([name, schema]) => [name, asObject(schema, name)]),
      ),
  };
}

/** The parts of a response the check reads. */
export interface CheckedResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

/** What is wrong with a response, against `spec`: its content type, headers and body. */
export async function checkResponse(
  contract: Contract,
  spec: ResponseSpec | null,
  response: CheckedResponse,
): Promise<Finding[]> {
  if (spec === null) {
    return [{ path: "status", message: `${response.status} is not a declared response` }];
  }

  const findings: Finding[] = [];
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith(spec.contentType)) {
    findings.push({
      path: "content-type",
      message: `expected ${spec.contentType}, got ${contentType}`,
    });
  }

  for (const [name, schema] of spec.headers) {
    const value = response.headers.get(name);
    if (value !== null) {
      findings.push(
        ...checkSchema(schema, headerValue(schema, value), contract.resolve, `header ${name}`),
      );
    }
  }

  findings.push(...checkSchema(spec.schema, await response.json(), contract.resolve));
  return findings;
}

/** A header carries text; a numeric schema reads the number in it. */
function headerValue(schema: Schema, text: string): unknown {
  const isNumeric = schema.type === "integer" || schema.type === "number";
  return isNumeric && /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : text;
}

function asObject(value: unknown, what = "a node"): Schema {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object in the contract`);
  }

  return value as Schema;
}
