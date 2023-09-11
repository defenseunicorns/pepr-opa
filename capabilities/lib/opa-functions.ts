import { a, Log, k8s } from "pepr";
import { EnvoyFilter } from "@kubernetes-models/istio/networking.istio.io/v1alpha3";

/**
 * Adds an Open Policy Agent (OPA) sidecar container to a Kubernetes Pod
 * if it doesn't already exist.
 *
 * @param p The Pod to which the OPA container should be added.
 */
export function addOpaSidecar(p: a.Pod): void {
  const OPA_CONTAINER_NAME = "opa";

  // Check if the OPA container is already present in the Pod spec
  if (p.spec.containers.some((c) => c.name === OPA_CONTAINER_NAME)) {
    Log.info(`OPA container already present in Pod ${p.metadata?.name}. Skipping addition.`);
    return;
  }

  // Get Policy ConfigMap from pod label
  const policyConfigMapVolume: k8s.V1ConfigMapVolumeSource = {
    name: p.metadata.labels["opa-injection"]
  }

  // Add volume holding policy.rego and config.yaml
  const policyVolume: k8s.V1Volume = {
    name: "opa-policy",
    configMap: policyConfigMapVolume
  }

  // Create the OPA sidecar container
  const opaSidecarContainer: k8s.V1Container = {
    name: OPA_CONTAINER_NAME,
    image: "openpolicyagent/opa:latest-envoy",
    args: [
      "run",
      "--server",
      "--config-file=/policy/config.yaml",
      "--addr=localhost:8181",
      "--addr=localhost:8282",
      "/policy/policy.rego"
    ],
    ports: [
      { containerPort: 8181 }, // Policy decision port
      { containerPort: 8282 }  // Health check port
    ],
    volumeMounts: [
      { mountPath: "/policy", name: "opa-policy" },
    ]
  };

  // Add the OPA container and volumes to the Pod
  p.spec.containers.push(opaSidecarContainer);
  p.spec.volumes.push(policyVolume);

  // Log()
  Log.info(`Added OPA container to Pod ${p.metadata?.name}.`);
}

/**
 * Creates the EnvoyFilter object required to filter requests to the OPA sidecar
 *
 * @param namePrefix The name of the workload to select by the filter
 */
export function createEnvoyFilter(
  namePrefix: string
): EnvoyFilter {
  const envoyFilter: EnvoyFilter = new EnvoyFilter({
    metadata: {
      name: `${namePrefix}-ext-authz`,
      namespace: "istio-system"
    },
    spec: {
      workloadSelector: {
        labels: {
          "app": namePrefix
        }
      },
      configPatches: [
        {
          applyTo: "HTTP_FILTER",
          match: {
            context: "SIDECAR_INBOUND",
            listener: {
              filterChain: {
                filter: {
                  name: "envoy.filters.network.http_connection_manager",
                  subFilter: {
                    name: "envoy.filters.http.router"
                  }
                }
              }
            }
          },
          patch: {
            operation: "INSERT_BEFORE",
            value: {
              name: "envoy.ext_authz",
              typed_config: {
                "@type": "type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthz",
                transport_api_version: "V3",
                status_on_error: {
                  code: "ServiceUnavailable"
                },
                with_request_body:{
                  max_request_bytes: 8192,
                  allow_partial_message: true
                },
                grpc_service: {
                  google_grpc: {
                    target_uri: "127.0.0.1:9191",
                    stat_prefix: "ext_authz"
                  }
                }
              },
            }
          }
        }
      ]
    }
  });

  envoyFilter.validate();

  return envoyFilter;
}