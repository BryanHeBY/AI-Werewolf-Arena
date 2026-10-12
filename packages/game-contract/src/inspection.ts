/**
 * Owns rule-revealed inspection data, separate from a target's true identity.
 * Inputs are contract role IDs and camp labels; outputs preserve the camp, role
 * and combined discriminated shapes. Eligibility and inspection calculations
 * belong to features, never to this pure data contract.
 */
import type { RoleId } from "./role-ids";

export type InspectionCamp = "good" | "wolf" | "third_party";
export type InspectionResult =
  | { kind: "camp"; camp: InspectionCamp }
  | { kind: "role"; role: RoleId }
  | { kind: "combined"; camp: InspectionCamp; role: RoleId };
export type InspectionKind = InspectionResult["kind"];
