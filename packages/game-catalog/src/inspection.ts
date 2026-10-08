import type { RoleId } from "./index";

/** Rule-revealed labels, which may differ from the target's real identity. */
export type InspectionCamp = "good" | "wolf" | "third_party";
export type InspectionResult =
  | { kind: "camp"; camp: InspectionCamp }
  | { kind: "role"; role: RoleId }
  | { kind: "combined"; camp: InspectionCamp; role: RoleId };
export type InspectionKind = InspectionResult["kind"];
