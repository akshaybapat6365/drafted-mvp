# Artifact Catalog and Retention

## Product Artifacts

- `plan_svg`
- `spec_json`
- `exterior_image` (optional)
- export package (zip)

## Operational Artifacts

- Prebeta reports under `var/reports/**`
- Nightly reliability artifacts from workflow uploads
- Live provider canary artifacts from workflow uploads

## Naming Conventions

- Reports: include run type and UTC timestamp.
- Generated files: include job ID where applicable.

## Retention Policy (Default)

- CI gate artifacts: 30 days minimum.
- Release decision artifacts: keep through next release cycle.
- Incident artifacts: keep until postmortem closure.

