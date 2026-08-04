import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wheel } from "./Wheel";
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
    const markup = renderToStaticMarkup(<Wheel users={[user(0)]} pingMatrix={{}} />);
    expect(markup).toContain('transform="translate(210 210) rotate(0)"');
    expect(markup).toContain('y2="-160"');
  });
});
