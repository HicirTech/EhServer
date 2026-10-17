/** The API contract built into the server; request bodies are checked against it (ADR-0008). */
import ContractText from "../../api/openapi.yaml" with { type: "text" };

import { loadContract } from "./contract";

export const ApiContract = loadContract(ContractText);
