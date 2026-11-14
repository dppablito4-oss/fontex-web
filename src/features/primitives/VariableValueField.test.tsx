import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { VariableValueField } from "./VariableValueField";

it("accepts an exact decimal outside the slider range on Enter, and cancels drafts with Escape", () => {
  const onChange = vi.fn();
  render(<VariableValueField variable={{ name: "b", value: 7, min: 1, max: 20, step: .1, unit: "cm" }} onChange={onChange} />);
  const input = screen.getByLabelText("Valor de b");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "100,25" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onChange).toHaveBeenLastCalledWith("b", 100.25);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "99" } });
  fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledTimes(1);
});

it("keeps invalid or empty input from changing the measure and describes the error", () => {
  const onChange = vi.fn();
  render(<VariableValueField variable={{ name: "b", value: 7, min: 1, max: 20, step: 1, unit: "cm" }} onChange={onChange} />);
  const input = screen.getByLabelText("Valor de b");
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);
  expect(onChange).not.toHaveBeenCalled();
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("alert")).toBeInTheDocument();
});
