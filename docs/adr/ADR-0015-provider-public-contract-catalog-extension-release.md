# ADR-0015: Provider Public Contract Catalog Extension Release

## Status

Accepted（v1.72.0 — Provider Public Contract Catalog Extension Release）

## Context

[ADR-0011](./ADR-0011-public-contract-catalog-future-layer-scope.md)（v1.68.0）により Application Layer `extract*PublicContract()` のみが Catalog authority と決定された。[ADR-0012](./ADR-0012-provider-contract-catalog-extension-strategy.md)（v1.69.0）により additive `providerContracts[]` strategy が確定したが、Catalog generator / reports 更新は Governance-approved Release まで **延期** された。

[ADR-0014](./ADR-0014-provider-level-4-implementation-ready-decision.md)（v1.71.0）により Provider domain **Level 4 Implementation Ready Declared**（domain-specific）。**Catalog Extension Release** は Mock Provider Production Implementation の **前提** として文書化されたが、v1.71.0 では registration **未実行**。

v1.72.0 は **Catalog Extension Release** — `providerContracts[]` additive registration のみ。Provider / Mock Provider / Adapter **実装は禁止**。

## Decision

### Release Type

| Item | Decision |
|------|----------|
| **Release scope** | **Catalog Extension Release** — generator + JSON + Markdown |
| **Production code**（Application / Provider impl） | **No change** — catalog module extension only |
| **`providerContracts[]` registration** | **Executed** — abstract contract authority only |
| **Provider Production Implementation** | **Not Started** |
| **Mock Provider Production Implementation** | **Not Started** |
| **Repository-wide Level 4 Implementation Ready** | **Not Declared** |

### Schema / Version

| Item | Decision |
|------|----------|
| **schema** | `public-contract-catalog/1.0` — **unchanged** |
| **catalogVersion** | `1.0` — **unchanged** |
| **Extension model** | Additive top-level `providerContracts[]` |

### Catalog Authority Preservation

| Item | Decision |
|------|----------|
| **`publicContracts[]`** | **Unchanged** — semantics, count, IDs, definitions |
| **`compatibilityMatrix`** | **Unchanged** — deep equality preserved |
| **Application foundations** | **Unchanged** |
| **Provider Contract SSOT** | [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md) — **no duplicate authority** |

### Registered Entry（v1.72.0）

| providerId | registrationKind | Authority |
|------------|------------------|-----------|
| `provider-abstract-contract-authority` | `abstract-contract-authority` | PROVIDER_LAYER_DESIGN.md §8–§14 |

### Explicitly NOT Registered

| Entry | Status |
|-------|--------|
| Mock Provider implementation | **Not registered** |
| Real Provider implementation | **Not registered** |
| SNS / OpenAI / Gemini / Nano Banana / External API Provider | **Not registered** |
| Adapter implementation | **Not registered** |

### providerContracts[] Entry Schema（v1.72.0）

```text
providerId                  — bounded identity string
providerVersion             — semantic version
providerType                — abstract | ai | sns | … (v1.72.0: abstract only)
layer                       — provider
registrationKind            — abstract-contract-authority
status                      — design-only
authorityDocument           — docs/architecture/PROVIDER_LAYER_DESIGN.md
authoritySections           — §8–§14 references
inputContractRef            — application-public-contract
outputContractRef           — normalized-provider-output
errorContractRef            — provider-error-contract
capabilityDeclaration       — capability-explicit-per-implementation
configurationSchema         — non-secret-only
credentialRequirement       — declaration-only
sideEffectDeclaration       — query-or-command
timeoutPolicyDeclaration    — provider-adapter-owned
retryPolicyDeclaration      — provider-local-only
implementationStatus        — not-started
```

**Forbidden in catalog entries:** credential / secret / token / password / apiKey / oauth fields or values.

### Deferred Operational Semantics（unchanged）

| Concern | Status |
|---------|--------|
| CL-004 Cross-layer retry | **Deferred** |
| CL-005 Cross-layer idempotency | **Deferred** |
| CL-006 Duplicate interaction | **Deferred** |
| Retry Engine / Recovery Engine | **Not implemented** |

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Register Mock Provider in v1.72.0 | Mock Production Implementation not authorized; violates Non-Goals boundary |
| Register Provider in `publicContracts[]` | ADR-0012 separation rule; Application authority blur |
| Bump catalog schema to 2.0 | ADR-0012 additive-only; no breaking change justified |
| New Provider Contract SSOT | Duplicates PROVIDER_LAYER_DESIGN authority |
| Declare repository-wide L4 Ready | G-23 Not Satisfied |

## Consequences

### Positive

- CL-013 **mitigated** — `providerContracts[]` traceability in JSON
- PR-004 **mitigated** — catalog registration executed; bypass prohibition reinforced
- ADR-0012 strategy **executed** at catalog layer
- Application backward compatibility **preserved**
- Provider L4 Ready Declared **maintained** — Catalog Extension prerequisite satisfied for next gate

### Negative / Remaining Exposure

- Provider / Mock Provider Production Implementation **still Not Started**
- PR-005 **remains Medium** — L4 Ready vs Production confusion until explicit impl Release
- CL-004 / CL-005 / CL-006 **unchanged — deferred**
- Concrete Provider implementations require **separate Governance Release**

## Compliance Impact

- ARCHITECTURE_COMPLIANCE_CHECKLIST §Provider Public Contract Catalog Extension added
- PROVIDER_LAYER_DESIGN authority maintained
- PROVIDER_CONTRACT_DEFINITION_REVIEW P4 registration evidence updated

## Compatibility Impact

- `publicContracts[]` — **no change**
- `compatibilityMatrix` — **no change**
- Legacy catalogs without `providerContracts[]` — **normalize** to canonical abstract authority entry

## Risk Impact

| ID | v1.72.0 Re-evaluation |
|----|----------------------|
| CL-013 | **Mitigated** — JSON traceability for Provider abstract authority |
| PR-004 | **Low** — catalog registration executed; bypass prohibition active |
| PR-005 | **Medium** — L4 Ready Declared + Catalog Extension complete; watch Production skip |
| CL-004 / CL-005 / CL-006 | **Unchanged — deferred** |

## Review Trigger

- Mock Provider Production Implementation Release proposed
- Additional `providerContracts[]` entries（concrete providers）proposed
- Catalog schema breaking change proposed

## Related Documents

- [ADR-0011](./ADR-0011-public-contract-catalog-future-layer-scope.md)
- [ADR-0012](./ADR-0012-provider-contract-catalog-extension-strategy.md)
- [ADR-0014](./ADR-0014-provider-level-4-implementation-ready-decision.md)
- [PROVIDER_LAYER_DESIGN.md](../architecture/PROVIDER_LAYER_DESIGN.md)
- [PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md](../architecture/PROVIDER_PUBLIC_CONTRACT_CATALOG_EXTENSION_REVIEW.md)
