import { describe, it, expect, vi } from "vitest";
import { readable } from "svelte/store";
import type { ServerAuth } from "$lib/stores/server-auth";
import {
  fallbackUserFor,
  UserProfileWrapperBloc,
  type ProfileUser,
} from "./UserProfileWrapper.bloc.svelte";

/**
 * These assertions used to run against a copy of `fallbackUserFor` pasted into
 * this file, because ts-jest could not load a `.svelte.ts` runes module and the
 * bloc is one. A copy can drift from the original without anything failing,
 * which is the opposite of what a test is for.
 *
 * Vitest compiles the module through vite-plugin-svelte, so the real bloc --
 * runes, `fromStore` and all -- is imported directly, and `displayUser` and
 * `status` are read off the real class rather than off a second copy of the
 * rules. There is no mirror left in this file.
 */

/** The bloc with its four ports stubbed; only the two reactive ones matter here. */
function bloc(
  isLoggedIn: boolean,
  query: { data?: ProfileUser | null; isLoading?: boolean; isError?: boolean },
) {
  return new UserProfileWrapperBloc({
    auth: readable({ isLoggedIn }),
    userQuery: readable(query),
    drawer: { open: () => {} },
    prompt: { requestLogin: () => {}, requestRegister: () => {} },
  });
}

describe("UserProfileWrapper logic", () => {
  describe("fallback user", () => {
    it("stands in for a failed user query while logged in", () => {
      expect(fallbackUserFor(true, true)).toEqual({
        username: "User",
        profileImageUrl: null,
      });
    });

    it('covers ANY failure, not only "Access denied"', () => {
      // The old rule matched on the error message, so a network error or a 500
      // produced no user at all and the header pulsed forever.
      expect(fallbackUserFor(true, true)).not.toBeNull();
    });

    it("is not used when nobody is logged in", () => {
      expect(fallbackUserFor(false, true)).toBeNull();
    });

    it("is not used when the query succeeded", () => {
      expect(fallbackUserFor(true, false)).toBeNull();
    });
  });

  describe("display user", () => {
    it("prefers real user data over the fallback", () => {
      const realUser = {
        username: "realuser",
        profileImageUrl: "real.jpg",
      } as ProfileUser;

      expect(bloc(true, { data: realUser, isError: true }).displayUser).toEqual(
        realUser,
      );
    });

    it("falls back when the query returned nothing and failed", () => {
      expect(bloc(true, { data: null, isError: true }).displayUser).toEqual({
        username: "User",
        profileImageUrl: null,
      });
    });

    it("is null when the query returned nothing and did not fail", () => {
      expect(bloc(true, { isError: false }).displayUser).toBeNull();
    });
  });

  describe("status", () => {
    it("is signed-out before anything is loaded", () => {
      expect(bloc(false, {}).status).toBe("signed-out");
    });

    it("is loading only while logged in", () => {
      expect(bloc(true, { isLoading: true }).status).toBe("loading");
      expect(bloc(false, { isLoading: true }).status).toBe("signed-out");
    });

    it("is ready once there is someone to render", () => {
      const user = { username: "User", profileImageUrl: null } as ProfileUser;

      expect(bloc(true, { data: user }).status).toBe("ready");
    });

    it("is stuck when the query settled with no user at all", () => {
      // The state that must NOT pulse: nothing is going to resolve it.
      expect(
        bloc(true, { data: null, isLoading: false, isError: false }).status,
      ).toBe("stuck");
    });
  });
});

describe("the server's answer, before the client store has resolved", () => {
  const unresolved = (isLoggedIn = false) =>
    readable({ isLoggedIn, isAuthInitialized: false });
  const resolved = (isLoggedIn: boolean) =>
    readable({ isLoggedIn, isAuthInitialized: true });
  const make = (
    auth: ReturnType<typeof unresolved>,
    serverAuth: ServerAuth | null,
    query = {},
  ) =>
    new UserProfileWrapperBloc({
      auth,
      serverAuth,
      userQuery: readable(query),
      drawer: { open: () => {} },
      prompt: { requestLogin: () => {}, requestRegister: () => {} },
    });

  it("renders the signed-in placeholder for a signed-in server, not Login/Register", () => {
    const bloc = make(unresolved(), { isLoggedIn: true });
    expect(bloc.isLoggedIn).toBe(true);
    expect(bloc.status).toBe("loading");
  });

  it("stays signed out when the server said so", () => {
    expect(make(unresolved(), { isLoggedIn: false }).status).toBe("signed-out");
  });

  it("is ready once the user details are in, even before the store resolves", () => {
    const bloc = make(
      unresolved(),
      { isLoggedIn: true },
      { data: { id: "u1", username: "ada", firstname: "A", lastname: "L" } },
    );
    expect(bloc.status).toBe("ready");
  });

  it("lets the resolved client store win over the server", () => {
    expect(make(resolved(false), { isLoggedIn: true }).status).toBe(
      "signed-out",
    );
    expect(
      make(resolved(true), { isLoggedIn: false }, { isError: true }).status,
    ).toBe("ready");
  });

  it("behaves as before without a server answer", () => {
    expect(make(unresolved(), null).status).toBe("signed-out");
  });

  describe("with the visitor's record fetched by the server", () => {
    const user = {
      id: "u1",
      username: "ada",
      firstname: "Ada",
      lastname: "L",
      profileImageUrl: "p.jpg",
    };

    it("is ready on the server render: the avatar is in the HTML, not a skeleton", () => {
      const bloc = make(unresolved(), { isLoggedIn: true, user });
      expect(bloc.status).toBe("ready");
      expect(bloc.displayUser).toEqual(user);
    });

    it("still renders it while the client query is on its way", () => {
      expect(
        make(unresolved(), { isLoggedIn: true, user }, { isLoading: true })
          .status,
      ).toBe("ready");
    });

    it("yields to the client query's own answer", () => {
      const fresh = {
        id: "u1",
        username: "ada2",
        firstname: "Ada",
        lastname: "L",
      } as ProfileUser;
      expect(
        make(resolved(true), { isLoggedIn: true, user }, { data: fresh })
          .displayUser,
      ).toEqual(fresh);
    });

    it("is dropped once the client store says signed out", () => {
      expect(make(resolved(false), { isLoggedIn: true, user }).status).toBe(
        "signed-out",
      );
    });
  });
});

describe("the header slot as the server renders it", () => {
  it("shows the placeholder rather than Login/Register for a signed-in response", async () => {
    const { render, screen } = await import("@testing-library/svelte");
    const { default: UserProfileWrapper } =
      await import("./UserProfileWrapper.svelte");
    const bloc = new UserProfileWrapperBloc({
      auth: readable({ isLoggedIn: false, isAuthInitialized: false }),
      serverAuth: { isLoggedIn: true },
      userQuery: readable({}),
      drawer: { open: () => {} },
      prompt: { requestLogin: () => {}, requestRegister: () => {} },
    });

    const { container } = render(UserProfileWrapper, { props: { bloc } });

    expect(screen.queryByRole("button", { name: "Login" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders the avatar from the server's record, with no skeleton to fill", async () => {
    const { render, screen } = await import("@testing-library/svelte");
    const { default: UserProfileWrapper } =
      await import("./UserProfileWrapper.svelte");
    const bloc = new UserProfileWrapperBloc({
      auth: readable({ isLoggedIn: false, isAuthInitialized: false }),
      serverAuth: {
        isLoggedIn: true,
        user: {
          id: "u1",
          username: "ada",
          firstname: "Ada",
          lastname: "L",
          profileImageUrl: null,
        },
      },
      userQuery: readable({}),
      drawer: { open: () => {} },
      prompt: { requestLogin: () => {}, requestRegister: () => {} },
    });

    const { container } = render(UserProfileWrapper, { props: { bloc } });

    expect(container.querySelector(".animate-pulse")).toBeNull();
    // The profile dropdown's trigger, carrying the avatar.
    expect(
      container.querySelector('button[aria-haspopup="true"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Login" })).toBeNull();
  });

  it("offers Login and Register as links to the auth pages, so they work without a script", async () => {
    const { render, screen } = await import("@testing-library/svelte");
    const { default: UserProfileWrapper } =
      await import("./UserProfileWrapper.svelte");
    const prompt = { requestLogin: vi.fn(), requestRegister: vi.fn() };
    const bloc = new UserProfileWrapperBloc({
      auth: readable({ isLoggedIn: false, isAuthInitialized: true }),
      serverAuth: { isLoggedIn: false },
      userQuery: readable({}),
      drawer: { open: () => {} },
      prompt,
    });

    render(UserProfileWrapper, { props: { bloc } });

    const login = screen.getByRole("link", { name: "Login" });
    expect(login).toHaveAttribute("href", "/auth/login");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "/auth/register",
    );
    // With a script, the click opens the modal in place and does not navigate.
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    login.dispatchEvent(event);
    expect(prompt.requestLogin).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
