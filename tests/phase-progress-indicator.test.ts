import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PhaseProgressIndicator } from "@/components/feed/PhaseProgressIndicator";

function checkmarkCount(html: string) {
  return (html.match(/stroke-width="2\.8"/g) ?? []).length;
}

describe("PhaseProgressIndicator", () => {
  it("keeps connecting active when complete is false", () => {
    const html = renderToStaticMarkup(createElement(PhaseProgressIndicator, { phase: "connecting", complete: false }));

    expect(checkmarkCount(html)).toBe(2);
    expect(html).toContain("bg-cyan-400/10");
  });

  it("marks connecting complete when complete is true", () => {
    const html = renderToStaticMarkup(createElement(PhaseProgressIndicator, { phase: "connecting", complete: true }));

    expect(checkmarkCount(html)).toBe(3);
    expect(html).not.toContain("bg-cyan-400/10");
  });
});
