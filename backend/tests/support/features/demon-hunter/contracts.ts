/**
 * Defines original demon-hunter planning data contracts for public test support. Inputs are explicitly
 * authored turn/actor/scenario data; outputs preserve the original nullable choices, source fields and
 * exact callback types. No game, model, filesystem, live permission or expected outcome is allocated or
 * computed here.
 */
import "../../../../src/app/bootstrap";
import { PotionType } from "../../../../src/core";

export interface DemonNightChoices {
  knife?: number | null;
  hunt?: number | null;
  guard?: number | null;
  potion?: { target: number; type: PotionType };
  shot?: number | null;
}
