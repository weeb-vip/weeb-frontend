import { describe, it, expect, vi } from "vitest";
import { loadServerUser } from "./server-user";

describe("loadServerUser", () => {
  it("fetches nothing for a signed-out visitor", async () => {
    const fetchDocument = vi.fn();
    expect(await loadServerUser(fetchDocument, false)).toBeNull();
    expect(fetchDocument).not.toHaveBeenCalled();
  });

  it("keeps only the fields the account slot reads: no email, no sessions", async () => {
    const fetchDocument = vi.fn().mockResolvedValue({
      UserDetails: {
        id: "u1",
        username: "ada",
        firstname: "Ada",
        lastname: "L",
        email: "ada@example.com",
        profileImageUrl: "p.jpg",
        active_sessions: [{ token: "secret" }],
      },
    });
    expect(await loadServerUser(fetchDocument, true)).toEqual({
      id: "u1",
      username: "ada",
      firstname: "Ada",
      lastname: "L",
      profileImageUrl: "p.jpg",
    });
  });

  it("is null when the fetch failed or came back empty, so the client fills the slot", async () => {
    expect(
      await loadServerUser(vi.fn().mockResolvedValue(null), true),
    ).toBeNull();
    expect(
      await loadServerUser(
        vi.fn().mockResolvedValue({ UserDetails: null }),
        true,
      ),
    ).toBeNull();
  });
});
