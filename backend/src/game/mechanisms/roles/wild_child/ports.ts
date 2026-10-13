/**
 * Exposes original wild child readiness and actual-night lifecycle bindings.
 * Inputs retain original World/day and outputs retain the same readiness or
 * closing capability. This boundary adds no state, copy, validation or rule;
 * setup, resource changes and knowledge remain in their concrete lifecycle owner.
 * At actual night entry, readiness is checked before opening. The returned close
 * follows the original finally order; terminal/currentness checks stay in the
 * lifecycle and this port never reopens a closed setup or action window.
 */
export { hasActiveWildChild, wildChildReady, openWildChildNight } from "./lifecycle";
