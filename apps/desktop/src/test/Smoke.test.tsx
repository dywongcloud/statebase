import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Welcome } from "../screens/Welcome";

describe("desktop smoke", () => {
  it("renders welcome screen", () => {
    render(<Welcome onConnected={() => undefined} onLocal={() => undefined} />);
    expect(screen.getByText("StateBase")).toBeTruthy();
    expect(screen.getByText("Connected Mode")).toBeTruthy();
  });
});
