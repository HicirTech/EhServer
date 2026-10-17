/** A request's JSON body, checked against its operation's schema in the contract (ADR-0008). */
import { ApiContract } from "../contract/api-contract";
import { checkSchema, findingText } from "../contract/schema";

export type BodyReading =
  | { readonly kind: "valid"; readonly body: unknown }
  | { readonly kind: "invalid"; readonly detail: string };

export async function readJsonBody(request: Request, operationId: string): Promise<BodyReading> {
  const schema = ApiContract.requestBody(operationId);
  if (schema === null) {
    throw new Error(`${operationId} takes no request body`);
  }

  if (!(request.headers.get("Content-Type") ?? "").startsWith("application/json")) {
    return { kind: "invalid", detail: "the body must be application/json" };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { kind: "invalid", detail: "the body is not JSON" };
  }

  const findings = checkSchema(schema, body, ApiContract.resolve);
  return findings.length === 0
    ? { kind: "valid", body }
    : { kind: "invalid", detail: findings.map(findingText).join("; ") };
}
