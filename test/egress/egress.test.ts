/** The mock egress (ADR-0005: every upstream request goes through an egress). */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { FirstGid, galleryToken } from "../../mock/catalog";
import { startMock } from "../../mock/server";
import { mockEgress } from "../../src/egress/egress";

const mock = startMock();
const egress = mockEgress(mock.url);
const signal = () => AbortSignal.timeout(5_000);

afterAll(() => mock.stop());

beforeEach(() => mock.clearRequests());

describe("mockEgress", () => {
  test("asks the mock for the site's host and the request's path, and returns the answer", async () => {
    const response = await egress.send({ site: "eh", target: "/toplist.php?tl=15&p=1" }, signal());

    expect(response.status).toBe(200);
    expect(response.site).toBe("eh");
    expect(response.body).toContain("Galleries Yesterday");
    expect(mock.requests()).toEqual([
      { method: "GET", host: "e-hentai.org", path: "/toplist.php", query: "?tl=15&p=1" },
    ]);
  });

  test("ExHentai requests go to its own host", async () => {
    const target = `/g/${FirstGid}/${galleryToken(FirstGid)}/`;

    await egress.send({ site: "ex", target }, signal());

    expect(mock.requests()).toMatchObject([{ host: "exhentai.org", path: target }]);
  });

  test("an error status is an answer to classify, not an exception", async () => {
    const response = await egress.send({ site: "eh", target: "/toplist.php?tl=21" }, signal());

    expect(response.status).toBe(404);
  });
});
