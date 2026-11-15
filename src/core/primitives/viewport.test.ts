import { expect, it } from "vitest";
import { templateScene } from "./templates";
import { sceneScope, niceTicks } from "./math";
import { equalPlotBounds, fitPlotBounds, panPlotBounds, zoomPlotBounds, type PlotBounds } from "./viewport";
import { organizePrimitiveScene } from "./layout";

it("fits a 100 cm rectangle and its neighbouring square without clipping either", () => {
  const scene = templateScene("geometry");
  scene.variables.find((v) => v.name === "b")!.value = 100;
  const plane = scene.primitives.find((p) => p.kind === "coordinate_canvas")!;
  if (plane.kind !== "coordinate_canvas") throw Error("Missing plane");
  const bounds = fitPlotBounds(plane, scene, sceneScope(scene));
  expect(bounds[0]).toBeLessThan(0);
  expect(bounds[1]).toBeGreaterThan(107);
  expect(bounds[2]).toBeLessThan(0);
  expect(bounds[3]).toBeGreaterThan(4);
  const ticks = niceTicks(bounds[0], bounds[1], 7);
  expect(ticks[1]! - ticks[0]!).toBeGreaterThanOrEqual(10);
});

it("reduces grid intervals on zoom without changing the anchor or shape proportions", () => {
  const original: PlotBounds = [0, 100, 0, 60];
  const closer = zoomPlotBounds(original, .1, [.25, .75]);
  expect(closer[0] + (closer[1] - closer[0]) * .25).toBeCloseTo(25);
  expect(closer[2] + (closer[3] - closer[2]) * .75).toBeCloseTo(45);
  const coarse = niceTicks(0, 100, 6), fine = niceTicks(closer[0], closer[1], 6);
  expect(fine[1]! - fine[0]!).toBeLessThan(coarse[1]! - coarse[0]!);
  const equal = equalPlotBounds(closer, 1.7);
  expect((equal[1] - equal[0]) / (equal[3] - equal[2])).toBeCloseTo(1.7);
});

it("keeps navigation within supported coordinate bounds and preserves span when panning", () => {
  const bounds: PlotBounds = [-5, 5, -3, 3];
  const panned = panPlotBounds(bounds, 1e6, -1e6);
  expect(panned).toEqual([9990, 10000, -10000, -9994]);
  for (const factor of [1e-10, 1e10]) {
    const zoomed = zoomPlotBounds(bounds, factor);
    expect(zoomed.every((v) => Math.abs(v) <= 10000)).toBe(true);
    expect(zoomed[1] - zoomed[0]).toBeGreaterThanOrEqual(.001);
  }
});

it("gives the plot the full width while keeping its definitions and controls intact", () => {
  const scene = organizePrimitiveScene(templateScene("geometry"));
  const plane = scene.primitives.find((p) => p.kind === "coordinate_canvas")!;
  const controls = scene.primitives.filter((p) => p.kind === "control_slider");
  const texts = scene.primitives.filter((p) => p.kind === "math_block");
  expect(plane.width).toBe(1152);
  expect(controls.length).toBeGreaterThan(0);
  expect(texts.length).toBeGreaterThan(0);
});
