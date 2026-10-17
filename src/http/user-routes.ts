/** `/api/v1/admin/users` (ADR-0006): who may hold API tokens. */
import type { User, UserStore } from "../store/users";
import { readJsonBody } from "./json-body";
import { problemResponse } from "./problem";
import type { Route } from "./router";

/** The body the createUser schema admits. */
interface UserCreate {
  readonly name: string;
}

export function userRoutes(users: UserStore, now: () => number = Date.now): Route[] {
  return [
    {
      method: "GET",
      path: "/api/v1/admin/users",
      scope: "admin",
      handler: (_request, { timing }) =>
        Response.json({ items: timing.measure("store", () => users.list()).map(userBody) }),
    },
    {
      method: "POST",
      path: "/api/v1/admin/users",
      scope: "admin",
      handler: async (request, { requestId, timing }) => {
        const reading = await readJsonBody(request, "createUser");
        if (reading.kind === "invalid") {
          return problemResponse("invalid_request", requestId, { detail: reading.detail });
        }

        const { name } = reading.body as UserCreate;
        const user = timing.measure("store", () => users.create(name, new Date(now())));
        return user === null
          ? problemResponse("conflict", requestId, { detail: `the user name ${name} is taken` })
          : Response.json(userBody(user), { status: 201 });
      },
    },
  ];
}

function userBody({ id, name, createdAt }: User) {
  return { id, name, createdAt: createdAt.toISOString() };
}
