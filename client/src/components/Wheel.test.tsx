import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wheel } from "./Wheel";
import type { HostRevealState } from "../hooks/useHostReveal";
import type { User } from "@lag-dowsing-rod/shared";

function user(slotIndex: number): User {
  return {
    userId: `u${slotIndex}`,
    userName: `User ${slotIndex}`,
    slotIndex,
    ping: 100,
    clientId: `c${slotIndex}`,
  };
}

describe("Wheel", () => {
  it("points the rod at the only user in the session", () => {
    const solo = user(0);
    const reveal: HostRevealState = {
      phase: "solo",
      bestHost: solo,
      rodAngleDegrees: -90,
      justRevealed: false,
    };
    const markup = renderToStaticMarkup(<Wheel users={[solo]} pingMatrix={{}} reveal={reveal} />);
    expect(markup).toContain('rotate(0deg)');
    expect(markup).toContain('y2="-160"');
  });

  it("runs the searching animation instead of pointing anywhere while sampling", () => {
    const users = [user(0), user(1)];
    const reveal: HostRevealState = {
      phase: "sampling",
      bestHost: null,
      rodAngleDegrees: 0,
      justRevealed: false,
    };
    const markup = renderToStaticMarkup(<Wheel users={users} pingMatrix={{}} reveal={reveal} />);
    expect(markup).toContain("rodSearch");
    expect(markup).toContain("Measuring connections…");
    expect(markup).not.toContain("HOST");
  });
});
