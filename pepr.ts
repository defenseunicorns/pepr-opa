import { PeprModule } from "pepr";
import cfg from "./package.json";
import { Opa } from "./capabilities/opa";

/**
 * This is the main entrypoint for this Pepr module
 */
new PeprModule(cfg, [
  Opa
]);
