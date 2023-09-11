import {
  AppsV1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  V1ConfigMap,
  NetworkingV1Api,
} from "@kubernetes/client-node";

import {
  EnvoyFilter,
} from "@kubernetes-models/istio/networking.istio.io/v1alpha3";

import { Log } from "pepr";

type K8sModel = {
  apiVersion: string;
  kind: string;
};

function getGroupVersionPlural(model: K8sModel) {
  const [group, version] = model.apiVersion.split("/");
  const plural = model.kind.toLocaleLowerCase() + "s";
  return { group, version, plural };
}

export class K8sAPI {
  k8sApi: CoreV1Api;
  k8sAppsV1Api: AppsV1Api;
  k8sCustomObjectsApi: CustomObjectsApi;
  networkingV1Api: NetworkingV1Api;

  constructor() {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(CoreV1Api);
    this.k8sAppsV1Api = kc.makeApiClient(AppsV1Api);
    this.k8sCustomObjectsApi = kc.makeApiClient(CustomObjectsApi);
    this.networkingV1Api = kc.makeApiClient(NetworkingV1Api);
  }

  async getConfigMap(
    name: string,
    namespace: string
  ): Promise<V1ConfigMap | undefined> {
    try {
      const response = await this.k8sApi.readNamespacedConfigMap(name, namespace);
      return response.body;
    } catch (error) {
      // If configmap not found, user will need to create it.
      if (error.response && error.response.statusCode === 404) {
        return;
      } else {
        throw error;
      }
    }
  }

  async upsertEnvoyFilter(envoyFilter: EnvoyFilter) {
    const { group, version, plural } = getGroupVersionPlural(EnvoyFilter);
    try {
      const response = await this.k8sCustomObjectsApi.getNamespacedCustomObject(
        group,
        version,
        envoyFilter.metadata.namespace,
        plural,
        envoyFilter.metadata.name
      );

      // If the resource exists, update it
      if (response && response.body) {
        const object = new EnvoyFilter(response.body);
        object.spec = envoyFilter.spec;

        await this.k8sCustomObjectsApi.replaceNamespacedCustomObject(
          group,
          version,
          envoyFilter.metadata.namespace,
          plural,
          envoyFilter.metadata.name,
          object,
          undefined,
          undefined,
          undefined
        );
      }

    } catch (error) {
      // If the resource doesn't exist, create it
      if (error.response && error.response.statusCode === 404) {
        await this.k8sCustomObjectsApi.createNamespacedCustomObject(
          group,
          version,
          envoyFilter.metadata.namespace,
          plural,
          envoyFilter
        );
      } else {
        throw error;
      }
    }
  }
}