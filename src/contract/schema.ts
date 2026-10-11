/**
 * Checks a value against a schema of the API contract (ADR-0008). It knows exactly the JSON Schema
 * the contract uses; any other keyword fails loudly instead of being skipped. Objects are closed:
 * a property the contract does not declare is a finding, so no undeclared field reaches a client.
 */
export type Schema = Readonly<Record<string, unknown>>;

export interface Finding {
  /** Where in the value, such as `$.entries[3].gallery.token`. */
  readonly path: string;
  readonly message: string;
}

export type Resolve = (ref: string) => Schema;

const KnownKeywords = new Set([
  "$ref",
  "type",
  "enum",
  "format",
  "pattern",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "multipleOf",
  "items",
  "minItems",
  "maxItems",
  "properties",
  "required",
  "allOf",
  "oneOf",
  "description",
  "default",
]);

/** Every instant is UTC (domain-model.md I6). */
const DateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export function checkSchema(
  schema: Schema,
  value: unknown,
  resolve: Resolve,
  path = "$",
): Finding[] {
  return check(schema, value, resolve, path, true);
}

/** Throws on the first keyword the checker does not know, anywhere under `schema`. */
export function assertKnownKeywords(schema: Schema, at = "$"): void {
  for (const [keyword, value] of Object.entries(schema)) {
    if (!KnownKeywords.has(keyword)) {
      throw new Error(`unsupported schema keyword ${keyword} at ${at}`);
    }

    for (const [name, child] of childSchemas(keyword, value)) {
      assertKnownKeywords(child, `${at}/${keyword}${name}`);
    }
  }
}

/**
 * `isClosed` is false only inside `allOf`, whose branches each declare part of one object; the
 * object is closed once, over all their properties together.
 */
function check(
  schema: Schema,
  value: unknown,
  resolve: Resolve,
  path: string,
  isClosed: boolean,
): Finding[] {
  for (const keyword of Object.keys(schema)) {
    if (!KnownKeywords.has(keyword)) {
      throw new Error(`unsupported schema keyword ${keyword} at ${path}`);
    }
  }

  const findings: Finding[] = [];
  const add = (message: string) => findings.push({ path, message });
  const ref = schema.$ref;
  if (typeof ref === "string") {
    findings.push(...check(resolve(ref), value, resolve, path, isClosed));
  }

  const types = schema.type === undefined ? null : ([] as unknown[]).concat(schema.type);
  if (types !== null && !types.some((type) => hasType(value, type))) {
    add(`expected ${types.join(" or ")}, got ${typeName(value)}`);
    return findings;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    add(`expected one of ${schema.enum.map(String).join(", ")}, got ${String(value)}`);
  }

  if (typeof value === "string") {
    findings.push(...checkString(schema, value, path));
  } else if (typeof value === "number") {
    findings.push(...checkNumber(schema, value, path));
  } else if (Array.isArray(value)) {
    findings.push(...checkArray(schema, value, resolve, path));
  } else if (typeof value === "object" && value !== null) {
    findings.push(...checkObject(schema, value, resolve, path, isClosed));
  }

  for (const branch of schemaList(schema.allOf)) {
    findings.push(...check(branch, value, resolve, path, false));
  }

  const oneOf = schemaList(schema.oneOf);
  if (oneOf.length > 0) {
    const matching = oneOf.filter(
      (branch) => check(branch, value, resolve, path, isClosed).length === 0,
    );
    if (matching.length !== 1) {
      add(`matches ${matching.length} of the ${oneOf.length} oneOf schemas`);
    }
  }

  return findings;
}

function checkString(schema: Schema, value: string, path: string): Finding[] {
  const findings: Finding[] = [];
  const length = [...value].length;
  if (typeof schema.minLength === "number" && length < schema.minLength) {
    findings.push({ path, message: `shorter than ${schema.minLength}` });
  }

  if (typeof schema.maxLength === "number" && length > schema.maxLength) {
    findings.push({ path, message: `longer than ${schema.maxLength}` });
  }

  if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) {
    findings.push({ path, message: `does not match ${schema.pattern}` });
  }

  const isBadInstant =
    schema.format === "date-time" &&
    (!DateTimePattern.test(value) || Number.isNaN(Date.parse(value)));
  if (isBadInstant) {
    findings.push({ path, message: `not a UTC date-time: ${value}` });
  }

  return findings;
}

function checkNumber(schema: Schema, value: number, path: string): Finding[] {
  const findings: Finding[] = [];
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    findings.push({ path, message: `below the minimum ${schema.minimum}` });
  }

  if (typeof schema.maximum === "number" && value > schema.maximum) {
    findings.push({ path, message: `above the maximum ${schema.maximum}` });
  }

  if (typeof schema.multipleOf === "number" && !Number.isInteger(value / schema.multipleOf)) {
    findings.push({ path, message: `not a multiple of ${schema.multipleOf}` });
  }

  return findings;
}

function checkArray(
  schema: Schema,
  value: readonly unknown[],
  resolve: Resolve,
  path: string,
): Finding[] {
  const findings: Finding[] = [];
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    findings.push({ path, message: `fewer than ${schema.minItems} items` });
  }

  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    findings.push({ path, message: `more than ${schema.maxItems} items` });
  }

  const items = asSchema(schema.items);
  if (items !== null) {
    for (const [index, item] of value.entries()) {
      findings.push(...check(items, item, resolve, `${path}[${index}]`, true));
    }
  }

  return findings;
}

function checkObject(
  schema: Schema,
  value: object,
  resolve: Resolve,
  path: string,
  isClosed: boolean,
): Finding[] {
  const findings: Finding[] = [];
  const fields = value as Readonly<Record<string, unknown>>;
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const name of required) {
    if (!(String(name) in fields)) {
      findings.push({ path, message: `missing required ${String(name)}` });
    }
  }

  const properties = asSchema(schema.properties) ?? {};
  for (const [name, property] of Object.entries(properties)) {
    const propertySchema = asSchema(property);
    if (name in fields && propertySchema !== null) {
      findings.push(...check(propertySchema, fields[name], resolve, `${path}.${name}`, true));
    }
  }

  /** A schema that is only a `$ref` leaves closing the object to the schema it refers to. */
  const describesObject = "properties" in schema || "allOf" in schema;
  if (isClosed && describesObject) {
    const declared = declaredProperties(schema, resolve);
    for (const name of Object.keys(fields)) {
      if (!declared.has(name)) {
        findings.push({ path, message: `undeclared property ${name}` });
      }
    }
  }

  return findings;
}

/** The properties a schema declares itself, through `$ref`, and through each `allOf` branch. */
function declaredProperties(schema: Schema, resolve: Resolve): Set<string> {
  const names = new Set(Object.keys(asSchema(schema.properties) ?? {}));
  const ref = schema.$ref;
  const parts = [...(typeof ref === "string" ? [resolve(ref)] : []), ...schemaList(schema.allOf)];
  for (const part of parts) {
    for (const name of declaredProperties(part, resolve)) {
      names.add(name);
    }
  }

  return names;
}

function hasType(value: unknown, type: unknown): boolean {
  switch (type) {
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
    case "boolean":
      return typeof value === type;
    default:
      throw new Error(`unsupported schema type ${String(type)}`);
  }
}

function typeName(value: unknown): string {
  if (value === null) {
    return "null";
  }

  return Array.isArray(value) ? "array" : typeof value;
}

function childSchemas(keyword: string, value: unknown): [string, Schema][] {
  switch (keyword) {
    case "items": {
      const items = asSchema(value);
      return items === null ? [] : [["", items]];
    }
    case "properties":
      return Object.entries(asSchema(value) ?? {}).flatMap(([name, property]) => {
        const child = asSchema(property);
        return child === null ? [] : [[`/${name}`, child] as [string, Schema]];
      });
    case "allOf":
    case "oneOf":
      return schemaList(value).map((child, index) => [`/${index}`, child]);
    default:
      return [];
  }
}

function schemaList(value: unknown): Schema[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const schema = asSchema(item);
    return schema === null ? [] : [schema];
  });
}

function asSchema(value: unknown): Schema | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Schema)
    : null;
}
