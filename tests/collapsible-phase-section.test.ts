import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CollapsiblePhaseSection } from "@/components/feed/CollapsiblePhaseSection";

function renderSection({
  isActive = false,
  isComplete = true,
  summary = "14 code reviews observed",
  label,
}: {
  isActive?: boolean;
  isComplete?: boolean;
  summary?: string;
  label?: string;
} = {}) {
  return renderToStaticMarkup(
    createElement(CollapsiblePhaseSection, {
      isActive,
      isComplete,
      summary: createElement("span", null, summary),
      label,
      children: createElement("div", null, "section-body"),
    }),
  );
}

describe("CollapsiblePhaseSection", () => {
  it("renders nothing when section is neither active nor complete", () => {
    const html = renderSection({ isActive: false, isComplete: false });

    expect(html).toBe("");
  });

  it("renders collapsed summary as a semantic button with optional label", () => {
    const html = renderSection({ label: "OBSERVING" });

    expect(html).toContain("OBSERVING");
    expect(html).toContain("14 code reviews observed");
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("section-body");
  });

  it("does not render label when label prop is omitted", () => {
    const html = renderSection();

    expect(html).not.toContain("OBSERVING");
    expect(html).toContain("14 code reviews observed");
  });

  it("renders active state children without collapsed summary button", () => {
    const html = renderSection({ isActive: true, isComplete: false });

    expect(html).toContain("section-body");
    expect(html).not.toContain('aria-expanded="false"');
    expect(html).not.toContain("14 code reviews observed");
  });
});
