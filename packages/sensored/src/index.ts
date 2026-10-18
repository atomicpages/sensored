import { setBinding } from "./native/binding";
import { loadNodeBinding } from "./native/node";

// In this module's body, not a side-effect-only import: `sideEffects: false`
// lets bundlers drop modules whose exports go unused.
setBinding(loadNodeBinding());

export * from "./api";
