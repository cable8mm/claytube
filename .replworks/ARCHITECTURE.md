# ClayTube — ARCHITECTURE

## 1. Purpose

- This document defines how ClayTube works internally: components, ownership, information flow, rules, failure boundaries, and invariants.
- This document is technology-agnostic.
- This document implements PRODUCT_SPEC.md and MUST NOT add product behavior that PRODUCT_SPEC.md does not define.
- Behavior not defined in PRODUCT_SPEC.md and not required by this document MUST NOT be implemented.
- Terms in this document are normative. MUST / MUST NOT are binding.

---

## 2. Core Concepts

| Concept | Definition |
| --- | --- |
| Project | A user-owned unit containing Project Configuration, Presentation Definition, and a Content Store. Created by `init`. |
| Project Configuration | User-authored settings: Site Settings and Channel Source List. Contains no Credential. |
| Site Settings | Site-level values used to present the portal. Contains at minimum the site title. |
| Channel Source List | Ordered list of content-source channel URLs. |
| Credential | Secret that authorizes access to the Content Source. Exists only in the execution environment. |
| Content Source | The external system that is the origin of channel and video data. ClayTube does not host videos. |
| Channel | Normalized record: identifier, title, URL, thumbnail reference. |
| Video | Normalized record: identifier, title, associated channel identifier, published date, thumbnail reference, URL. |
| Content Snapshot | The complete set of Channels and Videos produced by one successful synchronization, in canonical order. |
| Content Store | The single persisted location of the current Content Snapshot within a Project. |
| Change Report | Description of differences between the stored Content Snapshot and a newly assembled Content Snapshot. |
| Presentation Definition | The rules and assets that determine how Site Settings and a Content Snapshot are presented. Supplied by the Project Template at `init`; owned by the Project afterward. |
| Project Template | Bundled starting contents used by `init`: initial Project Configuration and Presentation Definition. |
| Built Site | Self-contained static output produced by a successful build. Requires no ClayTube component, Credential, or Content Store at viewing time. |
| Hosting Target | The supported publication destination defined in PRODUCT_SPEC.md. |

---

## 3. System Flow

Commands are user-driven and independent. No command invokes another command.

### 3.1 `init`

1. C1 validates the invocation and dispatches to C2.
2. C2 verifies the target location can be populated without overwriting existing content.
3. C2 populates the Project from the Project Template.
4. If `--git` is given, C2 initializes version control in the Project.
5. C1 reports success.

### 3.2 `sync`

1. C1 validates options (`--config`, `--dry-run`) and dispatches to C4.
2. C4 requests the Channel Source List from C3 (default or alternate configuration location).
3. C3 validates and returns the Channel Source List.
4. C4 removes duplicate channel URLs.
5. C4 asks C5 to confirm Credential availability. Failure ends the flow.
6. For each channel, C4 asks C5 for the Channel and all its available Videos.
7. C5 resolves, retrieves, normalizes, and returns records.
8. C4 assembles the Content Snapshot in canonical order.
9. C4 reads the current Content Snapshot from C6 and computes the Change Report.
10. If `--dry-run` is NOT given, C4 commits the Content Snapshot to C6 as one atomic replacement.
11. C4 returns the Change Report to C1. C1 presents it.

### 3.3 `build`

1. C1 dispatches to C7.
2. C7 requests Site Settings from C3 (default configuration location).
3. C7 reads the Content Snapshot from C6.
4. C7 applies the Presentation Definition and produces the Built Site.
5. C1 reports success.

### 3.4 `deploy`

1. C1 dispatches to C8.
2. C8 verifies a complete Built Site exists.
3. C8 publishes the Built Site to the Hosting Target.
4. C1 reports success.

### 3.5 Content Update Cycle (FR-08)

`sync` → `build` → `deploy`. Each step is a separate user invocation. Content changes reach the published site only through this sequence.

---

## 4. Components

| ID | Component |
| --- | --- |
| C1 | Command Interface |
| C2 | Project Initializer |
| C3 | Configuration Loader |
| C4 | Sync Orchestrator |
| C5 | Content Source Adapter |
| C6 | Content Store |
| C7 | Site Builder |
| C8 | Publisher |

---

## 5. Component Responsibilities

### C1 — Command Interface

**Responsibilities**

- MUST recognize exactly these commands: `init`, `sync`, `build`, `deploy`.
- MUST recognize exactly these options: `--git` (init), `--config` and `--dry-run` (sync).
- MUST reject unsupported commands, options, and arguments with an explicit usage error.
- MUST dispatch each command to exactly one owning component: `init`→C2, `sync`→C4, `build`→C7, `deploy`→C8.
- MUST present all results, Change Reports, and errors to the user.
- MUST signal overall failure of an invocation to the calling environment when any error occurs.

**Inputs:** user invocation (command, options, arguments).
**Outputs:** dispatch request to one component; user-visible messages; invocation status.

**Ownership boundary**

- Owns: command grammar, usage errors, error presentation, invocation status.
- Does NOT own: configuration, content, Credential, or any domain logic.

### C2 — Project Initializer

**Responsibilities**

- MUST create a Project at the target location (current location when none is given).
- MUST populate the Project exclusively from the Project Template.
- MUST NOT overwrite or delete existing content in the target location.
- MUST fail with an initialization error, leaving the target location unchanged, when it cannot populate the Project without overwriting or deleting existing content.
- MUST remove any content it created in an invocation that fails.
- MUST initialize version control in the Project when `--git` is given.
- MUST ensure the Project Template contains no real Credential.
- MUST ensure the Project is created with no Content Snapshot (never synchronized).

**Inputs:** target location; `--git` flag; Project Template.
**Outputs:** populated Project (Project Configuration, Presentation Definition); optional version-control initialization; result or error.

**Ownership boundary**

- Owns: Project Template, Project creation.
- Does NOT own: reading configuration, synchronization, building, publishing.

### C3 — Configuration Loader

**Responsibilities**

- MUST locate Project Configuration: the default location, or the alternate location supplied for `sync`.
- MUST parse Project Configuration and report an explicit configuration error if it is missing or unreadable.
- MUST provide Site Settings to C7.
- MUST provide the Channel Source List to C4.
- MUST validate that each channel URL is a well-formed channel URL of the Content Source; an invalid URL is a configuration error naming the URL.
- MUST validate that the Channel Source List contains at least one channel URL when it is requested by C4.
- MUST validate that Site Settings contain the site title when requested by C7.
- MUST return configuration exactly as written (no deduplication, no ordering).

**Inputs:** configuration location (default or alternate); request type (Site Settings or Channel Source List).
**Outputs:** Site Settings or Channel Source List; configuration error.

**Ownership boundary**

- Owns: reading and validating Project Configuration.
- Does NOT own: Credential (MUST NOT read, accept, or return it), content, retrieval, writing configuration.

### C4 — Sync Orchestrator

**Responsibilities**

- MUST coordinate the complete `sync` flow (Section 3.2).
- MUST remove duplicate channel URLs before retrieval.
- MUST confirm Credential availability through C5 before any retrieval.
- MUST request retrieval from C5; MUST NOT contact the Content Source directly.
- MUST assemble the Content Snapshot in canonical order:
  - Channels ordered by title ascending; ties ordered by channel identifier ascending.
  - Videos ordered by published date descending; ties ordered by video identifier ascending.
- MUST compute the Change Report: for Channels and Videos, which are added, removed, or changed, relative to the stored Content Snapshot (a missing stored Content Snapshot is treated as empty).
- MUST commit the Content Snapshot to C6 only if all channels were retrieved successfully and `--dry-run` is not set.
- MUST be the only component that writes to C6.
- MUST produce an identical Change Report for `--dry-run` and for a real sync run on the same inputs.

**Inputs:** optional alternate configuration location; dry-run flag; Channel Source List (C3); Channel and Video records (C5); stored Content Snapshot (C6).
**Outputs:** Change Report; committed Content Snapshot (non-dry-run only); errors.

**Ownership boundary**

- Owns: deduplication, canonical ordering, snapshot assembly, change detection, commit decision.
- Does NOT own: configuration parsing (C3), retrieval or normalization (C5), persistence mechanics (C6), presentation (C7).

### C5 — Content Source Adapter

**Responsibilities**

- MUST be the only component that accesses the Content Source.
- MUST be the only component that reads or uses the Credential.
- MUST read the Credential only from the execution environment.
- MUST report a credential error when the Credential is missing, before any retrieval is attempted.
- MUST resolve a channel URL to a channel identity; failure to resolve is reported as an invalid channel URL error naming the URL.
- MUST retrieve the Channel and all Videos the Content Source makes available for that channel.
- MUST normalize retrieved data into Channel and Video records with all required fields (Section 2).
- MUST report Content Source rejection or unavailability as a source error identifying the affected channel.
- MUST NOT persist, log, return, or include the Credential in any output or error message.

**Inputs:** channel URL; Credential (execution environment).
**Outputs:** Channel record; Video records; credential error, invalid channel URL error, or source error.

**Ownership boundary**

- Owns: Content Source access, Credential use, normalization into the Content Model.
- Does NOT own: ordering, deduplication of channel URLs, change detection, persistence, configuration.

### C6 — Content Store

**Responsibilities**

- MUST hold exactly one Content Snapshot per Project.
- MUST accept a complete replacement of the Content Snapshot from C4 only.
- MUST make each replacement atomic: readers see the previous complete Content Snapshot or the new complete Content Snapshot, never a partial one.
- MUST return the stored Content Snapshot, or an explicit "no Content Snapshot" indication, to C4 and C7.
- MUST preserve the canonical order of the stored Content Snapshot.
- MUST store references to thumbnails and videos only; MUST NOT store media.
- MUST NOT contain Credential or any secret.

**Inputs:** replacement request (C4); read requests (C4, C7).
**Outputs:** Content Snapshot or "no Content Snapshot"; store error.

**Ownership boundary**

- Owns: persistence and integrity of the Content Snapshot.
- Does NOT own: how snapshots are assembled, ordered, compared, or presented.

### C7 — Site Builder

**Responsibilities**

- MUST obtain Site Settings from C3 using the default configuration location.
- MUST obtain the Content Snapshot from C6.
- MUST fail with a build error when no Content Snapshot exists or Site Settings are invalid.
- MUST apply the Presentation Definition to produce the Built Site.
- MUST present, at minimum: Channel title, URL, thumbnail; Video title, associated Channel, published date, thumbnail, URL.
- MUST apply the PRODUCT_SPEC presentation principles (FR-09 and PRODUCT_SPEC Section 6): large thumbnails, clean typography, editorial layout, content-focused, minimal UI; no dashboard-style presentation, no clutter, no excessive filtering.
- MUST preserve Content Snapshot order wherever Channels or Videos are listed.
- MUST NOT contact the Content Source or access the Credential.
- MUST NOT modify C6 or Project Configuration.
- MUST produce identical Built Site content for identical inputs.
- MUST NOT leave partial output on failure: after a failed build the Built Site location contains either the previous complete Built Site or nothing.

**Inputs:** Site Settings (C3); Content Snapshot (C6); Presentation Definition.
**Outputs:** Built Site; build error.

**Ownership boundary**

- Owns: transformation of Site Settings and Content Snapshot into the Built Site; the Built Site location.
- Does NOT own: content retrieval, content ordering, Content Store writes, publication.

### C8 — Publisher

**Responsibilities**

- MUST publish the Built Site to the Hosting Target.
- MUST fail with a publish error when no complete Built Site exists.
- MUST publish the Built Site unchanged.
- MUST NOT trigger `sync` or `build`.
- MUST NOT read the Content Store, Project Configuration, or the content-source Credential.
- MUST NOT include any secret in published output.
- MUST report publication failure explicitly.

**Inputs:** Built Site; publication authorization supplied by the execution environment for the Hosting Target.
**Outputs:** published site at the Hosting Target; publish error.

**Ownership boundary**

- Owns: transfer of the Built Site to the Hosting Target.
- Does NOT own: building, content, configuration, Content Source access.

---

## 6. Responsibility Boundaries

### 6.1 Requirement Ownership

| PRODUCT_SPEC requirement | Owner | Supporting |
| --- | --- | --- |
| FR-01 Initialize a project (`init`, `--git`) | C2 | C1 |
| FR-02 Configure channels | C3 | — |
| FR-03 Synchronize (`sync`) | C4 | C1, C3, C5, C6 |
| FR-04 Preview synchronization (`--dry-run`) | C4 | C1 |
| FR-05 Alternative configuration (`--config`) | C3 | C1, C4 |
| FR-06 Build (`build`) | C7 | C1, C3, C6 |
| FR-07 Publish (`deploy`) | C8 | C1 |
| FR-08 Update content | C4 + C7 + C8 (via Section 3.5) | — |
| FR-09 Content-focused presentation | C7 | Presentation Definition |
| Error: invalid YouTube URL | C3 (malformed), C5 (unresolvable) | C1 presents |
| Error: missing API key | C5 | C1 presents |
| Error: build failure | C7 | C1 presents |

### 6.2 Single-Owner Rules

| Responsibility | Sole owner |
| --- | --- |
| Command grammar and usage errors | C1 |
| Error presentation and invocation status | C1 |
| Project creation and Project Template | C2 |
| Reading and validating Project Configuration | C3 |
| Channel URL deduplication | C4 |
| Canonical ordering | C4 |
| Change detection | C4 |
| Writing to the Content Store | C4 |
| Content Source access | C5 |
| Credential use | C5 |
| Normalization into Channel and Video records | C5 |
| Persistence of the Content Snapshot | C6 |
| Producing the Built Site | C7 |
| Transferring the Built Site to the Hosting Target | C8 |

### 6.3 Prohibited Interactions

- C1 MUST NOT call C3, C5, or C6 directly.
- C3 MUST NOT call any other component.
- C5 MUST NOT call C3, C6, C7, or C8.
- C6 MUST NOT call any other component.
- C7 MUST NOT call C4, C5, or C8.
- C8 MUST NOT call C3, C4, C5, C6, or C7.
- C2 MUST NOT call C3, C4, C5, C6, C7, or C8.

---

## 7. Data Flow

### 7.1 Artifacts and Ownership

| Artifact | Producer | Consumers | Persistent |
| --- | --- | --- | --- |
| Project Configuration | User (initial from C2) | C3 | Yes |
| Presentation Definition | C2 (initial); then user | C7 | Yes |
| Credential | User (execution environment) | C5 | No (never stored by ClayTube) |
| Channel / Video records | C5 | C4 | No |
| Content Snapshot (assembled) | C4 | C4, C6 | No |
| Content Snapshot (stored) | C6 | C4, C7 | Yes |
| Change Report | C4 | C1 | No |
| Built Site | C7 | C8 | Yes |
| Published site | C8 | End viewers | At Hosting Target |

### 7.2 Flows

```text
init:    User → C1 → C2 → Project (Project Configuration, Presentation Definition)

sync:    User → C1 → C4
         C4 → C3 → Channel Source List → C4
         C4 → C5 (channel URL) → Content Source
         Content Source → C5 → Channel/Video records → C4
         C4 ⇄ C6 (read stored snapshot)
         C4 → C6 (replace snapshot; not in --dry-run)
         C4 → Change Report → C1 → User

build:   User → C1 → C7
         C7 → C3 → Site Settings → C7
         C7 ← C6 (Content Snapshot)
         C7 + Presentation Definition → Built Site

deploy:  User → C1 → C8
         C8 ← Built Site
         C8 → Hosting Target
```

### 7.3 Flow Rules

- Content moves from the Content Source to the Built Site only through C5 → C4 → C6 → C7.
- The Channel Source List influences content only through `sync`. `build` renders the Content Snapshot as stored, regardless of the Channel Source List.
- An alternate configuration location (`--config`) applies to that `sync` invocation only. It does not change the Content Store location, the configuration used by `build`, or any later command.
- The Content Store location is fixed per Project and is the same for every `sync` invocation.
- The Credential flows only from the execution environment to C5.
- `build` reads Site Settings from the default configuration location only.
- `deploy` consumes the most recent successful Built Site. `deploy` does not check whether it reflects the latest Content Snapshot.

---

## 8. Architectural Rules

- AR-01: Every PRODUCT_SPEC requirement has exactly one owning component (Section 6.1).
- AR-02: Every responsibility has exactly one owner (Section 6.2). Shared ownership MUST NOT exist.
- AR-03: Components interact only through the inputs and outputs defined in Section 5 and the flows in Section 7.
- AR-04: Synchronization (C4, C5, C6 writes) and rendering (C7) are separate. Neither invokes the other.
- AR-05: Content Source access is isolated in C5. No other component has source-specific knowledge beyond the channel URL form validated by C3.
- AR-06: Command handling (C1) contains no domain logic.
- AR-07: Synchronization is a snapshot replacement: after a successful non-dry-run `sync`, the stored Content Snapshot equals exactly the assembled Content Snapshot. Videos or Channels no longer present in the assembled result are no longer in the store.
- AR-08: Synchronization is all-or-nothing. If any channel fails, nothing is committed.
- AR-09: `--dry-run` performs every step of `sync` except the commit to C6.
- AR-10: Canonical ordering is applied once, by C4. No other component re-sorts.
- AR-11: Every Channel and Video carries a stable identifier assigned by the Content Source. Identity comparison in change detection uses identifiers only.
- AR-12: The Content Store holds references to media, never media.
- AR-13: Every failure is reported explicitly through C1. No component suppresses, swallows, or downgrades an error.
- AR-14: `build` fails when the Content Store has no Content Snapshot.
- AR-15: `deploy` does not run `build`. `build` does not run `sync`.
- AR-16: Presentation (C7) never modifies content; content (C4, C6) never contains presentation.
- AR-17: The Credential is never part of Project Configuration, Content Snapshot, Change Report, Built Site, published output, error messages, or any user-visible message.

---

## 9. Failure Boundaries

| Failure | Detected by | Effect | State guarantee | Reported by |
| --- | --- | --- | --- | --- |
| Unsupported command / option / argument | C1 | Invocation stops before dispatch | No state changes | C1 |
| Target cannot be populated without overwriting | C2 | `init` fails | Target unchanged | C1 |
| `init` fails partway | C2 | Content created by the invocation is removed | No partial Project remains | C1 |
| Configuration missing / unreadable | C3 | Requesting command fails | No state changes | C1 |
| Invalid (malformed) channel URL | C3 | `sync` fails before any retrieval | Content Store unchanged | C1 |
| No channel URLs configured | C3 | `sync` fails before any retrieval | Content Store unchanged | C1 |
| Site title missing | C3 | `build` fails | Content Store unchanged | C1 |
| Credential missing | C5 | `sync` fails before any retrieval | Content Store unchanged | C1 |
| Channel URL unresolvable | C5 | `sync` fails | Content Store unchanged | C1 |
| Content Source rejects or is unavailable | C5 | `sync` fails | Content Store unchanged | C1 |
| Any channel fails during `sync` | C4 | Entire `sync` fails | Content Store unchanged | C1 |
| Content Store commit fails | C6 | `sync` fails | Previous complete Content Snapshot remains | C1 |
| `--dry-run` | C4 | Change Report only | Content Store never written | C1 |
| No Content Snapshot at `build` | C7 | `build` fails | Content Store unchanged | C1 |
| Build fails | C7 | `build` fails | Built Site location holds previous complete output or nothing | C1 |
| No complete Built Site at `deploy` | C8 | `deploy` fails | Built Site and Hosting Target unchanged | C1 |
| Publication fails | C8 | `deploy` fails | Built Site, Content Store, Project Configuration unchanged | C1 |

- Failure categories: usage error, initialization error, configuration error, credential error, invalid channel URL error, source error, store error, build error, publish error.
- Every failure MUST name its category and the affected item (channel URL, location, or step).
- A failure in one command MUST NOT alter the state owned by a different command, except as stated above.

---

## 10. Non-Goals

- Replacing YouTube as a video platform.
- Hosting or storing video or thumbnail media.
- A general-purpose content management system.
- A dashboard-style administration interface.
- Filtering beyond what PRODUCT_SPEC defines (excessive filtering is excluded).
- A runtime service, backend, or database required by the Built Site.
- Any behavior at viewing time that depends on ClayTube components.
- Automatic, scheduled, or background synchronization or publication.
- Partial or per-channel incremental commits to the Content Store.
- Detection of Built Site staleness relative to the Content Snapshot.
- Collection, storage, or transmission of end-viewer data by ClayTube.
- Any behavior not defined in PRODUCT_SPEC.md or in this document.

---

## 11. Architectural Invariants

- INV-01: Each PRODUCT_SPEC requirement has exactly one owning component.
- INV-02: Each responsibility has exactly one owning component.
- INV-03: Only C5 accesses the Content Source.
- INV-04: Only C5 uses the Credential.
- INV-05: The Credential never appears in Project Configuration, Content Store, Change Report, Built Site, published output, or messages.
- INV-06: Only C4 writes to the Content Store.
- INV-07: The Content Store always holds one complete, consistent Content Snapshot or none.
- INV-08: A `sync` that fails leaves the Content Store exactly as it was before the invocation.
- INV-09: `--dry-run` never changes any persisted state.
- INV-10: The Content Snapshot is always in canonical order, assigned only by C4.
- INV-11: Identical source data and configuration always produce an identical Content Snapshot.
- INV-12: Identical Site Settings, Content Snapshot, and Presentation Definition always produce identical Built Site content.
- INV-13: The Built Site is self-contained static content that needs no ClayTube component, Credential, or Content Store at viewing time.
- INV-14: `build` never contacts the Content Source; `sync` never produces a Built Site; `deploy` never changes content.
- INV-15: A failed `build` never leaves partial output in the Built Site location.
- INV-16: `deploy` publishes only a complete Built Site.
- INV-17: Every failure is reported explicitly and results in a failure status for the invocation.
- INV-18: ClayTube never stores media.
- INV-19: No component implements behavior that PRODUCT_SPEC.md does not define.
