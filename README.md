# Pepr-OPA Module

This Pepr module is intended to integrate [Open Policy Agent](https://www.openpolicyagent.org/docs/latest/) as an Authorization check for users trying to access workloads. The use of OPA would potentially be relevant if you need fine-grained authorization control that would be too much for say an Istio AuthorizationPolicy.

To test this Capability, create a cluster with Istio running and apply the "./tests". Each `httpbin` app has different endpoints allowed, as per the Rego in the configmaps.

⚠️ **Warning**: This has not been extensively tested and should be taken as very prototype

*These are very simple examples, the intent was not to stretch the limits of Rego, but to play around with how Pepr could aid the implementation. More interesting use cases might be to integrate JWTs into the rego authorization policy and have user properties provide logic checks for APIs or could do something really hacky like making conditional http requests when a service is accessed - doing things like logging user info, other external service access requests, etc.*
