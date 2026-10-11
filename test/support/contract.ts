/** The API contract, loaded once for the tests that check responses against it (nfr.md MAINT-2). */
import { checkResponse, loadContract } from "../../src/contract/contract";
import type { Finding } from "../../src/contract/schema";

export const ContractPath = `${import.meta.dir}/../../api/openapi.yaml`;
export const contract = loadContract(await Bun.file(ContractPath).text());

/** The findings for a response of `operationId`; the response stays readable. */
export function responseFindings(operationId: string, response: Response): Promise<Finding[]> {
  return checkResponse(contract, contract.response(operationId, response.status), response.clone());
}

/** The findings for a problem answered outside any operation, such as an unknown path. */
export function problemFindings(response: Response): Promise<Finding[]> {
  return checkResponse(contract, contract.problem(), response.clone());
}
