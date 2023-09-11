import { Capability, a, Log } from "pepr";
import { K8sAPI } from "./lib/kubernetes-api";
import { addOpaSidecar, createEnvoyFilter } from "./lib/opa-functions";

/**
 *  OPA Capability to add Open Policy Agent Integration into a workload in cluster
 *  Requires Istio running
 */
export const Opa = new Capability({
  name: "opa",
  description: "OPA Capability to add Open Policy Agent Integration into a workload in cluster"
});

const { When } = Opa;

/**
 * ---------------------------------------------------------------------------------------------------
 *                                   Mutate Workload with OPA Sidecar                                *
 * ---------------------------------------------------------------------------------------------------
 *
 * This action should look for a workload with the label "opa-injection" and the value to be the name
 * of a ConfigMap with the desired policy; the workload should also have the "app" label - 
 * the mutation should create an OPA sidecar to the workload and add the EnvoyFilter to tell Envoy to 
 * get the Authz decision from OPA
 */
When(a.Pod)
  .IsCreated()
  .WithLabel("opa-injection")
  .WithLabel("app")
  .Mutate(async p => {
    // Add sidecar with OPA things
    addOpaSidecar(p.Raw);

    // Add EnvoyFilter for workload 
    const app = p.Raw.metadata?.labels["app"];
    if (!app) { return; }
    const envoyFilter = createEnvoyFilter(app);
    const k8s = new K8sAPI();
    try {
      await k8s.upsertEnvoyFilter(envoyFilter);
    } catch (e) {
      Log.error(`There's an error: ${e}`)
    }
  });

// Probably should remove EnvoyFilter from Pod if removed... TBD
// When(a.Pod)
//   .IsDeleted()
//   .Mutate(
//     // Do stuff
//   );
