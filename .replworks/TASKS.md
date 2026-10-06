# TASKS

Execution order is top to bottom. Task selection and execution follow AGENTS.md.

---

## MVP

- [X] T-001 Project foundation
  - Satisfies: PRODUCT_SPEC.md §3 (free and open source CLI product)
  - Components: none
  - Depends on: none
  - External boundary: no
  - Acceptance criteria:
    - Every constraint in TECH_STACK.md is satisfied.
    - Every check defined in TECH_STACK.md passes (Section 4 checks and the production build).
    - Unit tests pass.

- [X] T-002 Reject unsupported invocations
  - Satisfies: PRODUCT_SPEC.md §5 (Commands), §9 (errors are presented, not ignored)
  - Components: Command Interface
  - Depends on: T-001
  - External boundary: no
  - Acceptance criteria:
    - An unrecognized command exits non-zero with a usage error naming the command.
    - An unrecognized option exits non-zero with a usage error naming the option.
    - An unsupported argument exits non-zero with a usage error.
    - An option given to a command it is not defined for (per PRODUCT_SPEC.md §5 and §7) exits non-zero with a usage error.
    - After each rejected invocation, no file in the working location is created, modified, or deleted.
    - Unit tests pass.

- [X] T-003 Initialize a project
  - Satisfies: PRODUCT_SPEC.md §7 FR-01; §11 criterion 1
  - Components: Command Interface, Project Initializer
  - Depends on: T-002
  - External boundary: no
  - Acceptance criteria:
    - `claytube init my-site` exits zero and creates a Project at `my-site` containing Project Configuration and Presentation Definition taken from the Project Template.
    - `claytube init` with no target creates the Project at the current location.
    - The created Project has no Content Snapshot.
    - No created content contains the value of a Credential set in the execution environment.
    - If the target holds existing content that would be overwritten or deleted, init exits non-zero with an initialization error naming the location, and the target is byte-identical to before.
    - If init fails partway, everything created by that invocation is removed.
    - Unit tests pass.

- [X] T-004 Initialize a project with version control
  - Satisfies: PRODUCT_SPEC.md §7 FR-01
  - Components: Command Interface, Project Initializer
  - Depends on: T-003
  - External boundary: yes (version control tool)
  - Acceptance criteria:
    - `claytube init my-site --git` exits zero and `my-site` is under version control.
    - `claytube init my-site` without `--git` leaves `my-site` not under version control.
    - If version control initialization fails, init exits non-zero with an initialization error and everything created by that invocation is removed.
    - A live observation of the version control tool's initialization behavior is recorded.
    - An E2E test against the live version control tool passes.
    - Unit tests pass.

- [X] T-005 Validate Project Configuration on sync
  - Satisfies: PRODUCT_SPEC.md §7 FR-02, FR-03; §9 (invalid YouTube URL)
  - Components: Command Interface, Configuration Loader, Sync Orchestrator
  - Depends on: T-003
  - External boundary: no
  - Acceptance criteria:
    - Missing or unreadable Project Configuration makes `claytube sync` exit non-zero with a configuration error naming the location; the Content Store is unchanged.
    - A malformed channel URL makes `claytube sync` exit non-zero with a configuration error naming the URL; no retrieval is attempted; the Content Store is unchanged.
    - An empty Channel Source List makes `claytube sync` exit non-zero with a configuration error; no retrieval is attempted; the Content Store is unchanged.
    - A Channel Source List of well-formed URLs is returned exactly as written (order and duplicates preserved).
    - Unit tests pass.

- [ ] T-006 Fail sync when the Credential is missing
  - Satisfies: PRODUCT_SPEC.md §9 (missing API key); §7 FR-03
  - Components: Command Interface, Sync Orchestrator, Content Source Adapter
  - Depends on: T-005
  - External boundary: no
  - Acceptance criteria:
    - With valid Project Configuration and no Credential in the execution environment, `claytube sync` exits non-zero with a credential error.
    - No retrieval is attempted before the credential error is reported.
    - The Content Store is unchanged.
    - Unit tests pass.

- [ ] T-007 Synchronize a single channel
  - Satisfies: PRODUCT_SPEC.md §7 FR-03; §6 (Channel Information, Video Information); §11 criteria 3, 4
  - Components: Command Interface, Configuration Loader, Sync Orchestrator, Content Source Adapter, Content Store
  - Depends on: T-006
  - External boundary: yes (YouTube)
  - Acceptance criteria:
    - With one valid channel URL and a Credential, `claytube sync` exits zero and the Content Store holds a Content Snapshot containing that Channel and every Video the Content Source makes available for it.
    - A channel with more Videos than a single Content Source response returns is stored completely.
    - Each stored Channel and Video has every required field defined in ARCHITECTURE.md Section 2.
    - The Content Store holds references to media only; it holds no media.
    - The Credential value appears in none of: Project Configuration, Content Store, standard output, error output.
    - A live observation of the Content Source's responses for channel resolution and video listing is recorded.
    - An E2E test against the live Content Source passes.
    - Unit tests pass.

- [ ] T-008 Synchronize multiple channels in canonical order
  - Satisfies: PRODUCT_SPEC.md §7 FR-02, FR-03; §11 criteria 2, 3
  - Components: Sync Orchestrator, Content Source Adapter, Content Store
  - Depends on: T-007
  - External boundary: no
  - Acceptance criteria:
    - With two or more channel URLs configured, the stored Content Snapshot contains the Channels and Videos of all of them.
    - A channel URL listed more than once is retrieved once, and the stored Content Snapshot contains no duplicate Channel.
    - The stored Content Snapshot is in the canonical order defined for Sync Orchestrator in ARCHITECTURE.md Section 5, verified with fixtures that include ties.
    - Two syncs on identical source data and configuration produce byte-identical stored Content Snapshots.
    - Tests use responses recorded in T-007's live observation.
    - Unit tests pass.

- [ ] T-009 Make sync all-or-nothing and report source failures
  - Satisfies: PRODUCT_SPEC.md §7 FR-03; §9 (invalid YouTube URL, errors are presented)
  - Components: Command Interface, Sync Orchestrator, Content Source Adapter, Content Store
  - Depends on: T-008
  - External boundary: yes (YouTube)
  - Acceptance criteria:
    - A well-formed channel URL the Content Source cannot resolve makes `claytube sync` exit non-zero with an invalid channel URL error naming the URL; the Content Store is byte-identical to before.
    - A request the Content Source rejects makes `claytube sync` exit non-zero with a source error identifying the affected channel; the Content Store is byte-identical to before.
    - With several channels configured, if any one fails, nothing is committed.
    - If committing fails, the previously stored complete Content Snapshot remains readable and unchanged, and a store error is reported.
    - Every failure names its category and the affected item as defined in ARCHITECTURE.md Section 9.
    - No error output contains the Credential value.
    - A live observation of the Content Source's behavior for an unresolvable channel URL and for a rejected Credential is recorded.
    - An E2E test against the live Content Source passes for both cases.
    - Unit tests pass.

- [ ] T-010 Replace the stored snapshot on re-sync
  - Satisfies: PRODUCT_SPEC.md §7 FR-03, FR-08; §8 Flow 2; §11 criterion 9
  - Components: Sync Orchestrator, Content Store
  - Depends on: T-009
  - External boundary: no
  - Acceptance criteria:
    - Given a stored Content Snapshot and source data that adds a Video, removes a Video, and changes a Video title, a successful sync leaves the stored Content Snapshot equal to exactly the newly assembled one.
    - The same holds for an added Channel and a removed Channel.
    - A channel removed from the Channel Source List is absent from the stored Content Snapshot after the next successful sync.
    - A sync on source data identical to the stored Content Snapshot leaves it byte-identical.
    - Tests use responses recorded in T-007 and T-009.
    - Unit tests pass.

- [ ] T-011 Preview synchronization with a Change Report
  - Satisfies: PRODUCT_SPEC.md §7 FR-03, FR-04; §8 Flow 3; §11 criterion 5
  - Components: Command Interface, Sync Orchestrator
  - Depends on: T-010
  - External boundary: no
  - Acceptance criteria:
    - A successful `claytube sync` prints a Change Report listing added, removed, and changed Channels and Videos relative to the previously stored Content Snapshot.
    - With no stored Content Snapshot, every retrieved item is reported as added.
    - A Video whose title changed is reported as changed, not as removed and added.
    - `claytube sync --dry-run` prints a Change Report and exits zero; the Content Store, Project Configuration, and every other file in the Project are byte-identical before and after.
    - On a Project that was never synchronized, `claytube sync --dry-run` leaves it with no Content Snapshot.
    - The Change Report from `--dry-run` is identical to the one from a real sync on the same inputs.
    - `--dry-run` reports configuration, credential, invalid channel URL, and source failures exactly as a real sync does, with non-zero exit.
    - Unit tests pass.

- [ ] T-012 Synchronize with an alternative configuration
  - Satisfies: PRODUCT_SPEC.md §7 FR-05; §8 Flow 4
  - Components: Command Interface, Configuration Loader, Sync Orchestrator
  - Depends on: T-011
  - External boundary: no
  - Acceptance criteria:
    - `claytube sync --config <path>` uses the Channel Source List at `<path>` and ignores the one at the default location.
    - The same Content Store is written as for `claytube sync` without `--config`.
    - A missing, unreadable, or invalid configuration at `<path>` produces the same errors as T-005 and leaves the Content Store unchanged.
    - `--config` and `--dry-run` can be combined; the result is a Change Report with no writes.
    - Unit tests pass.

- [ ] T-013 Build the video portal
  - Satisfies: PRODUCT_SPEC.md §7 FR-06, FR-09 (verifiable behavior only); §6 Outputs; §11 criteria 6, 7 (verifiable behavior only)
  - Components: Command Interface, Configuration Loader, Content Store, Site Builder
  - Depends on: T-012
  - External boundary: no
  - Acceptance criteria:
    - With a stored Content Snapshot and valid Site Settings, `claytube build` exits zero and produces a Built Site.
    - The Built Site contains, for each Channel: title, URL, thumbnail; and for each Video: title, associated Channel, published date, thumbnail, URL; verified against provided content.
    - The site title from Site Settings is rendered; the test verifies the provided value is shown, not its wording.
    - Channels and Videos appear in Content Snapshot order wherever they are listed.
    - Serving the Built Site as plain static files renders all of the above.
    - `claytube build` makes no request to the Content Source.
    - The Credential value, when set in the execution environment during build, appears nowhere in the Built Site.
    - The Content Store and Project Configuration are byte-identical before and after `claytube build`.
    - Two builds with identical Site Settings, Content Snapshot, and Presentation Definition produce identical Built Site content.
    - After a prior `claytube sync --config <path>`, `claytube build` still reads Site Settings from the default location.
    - Unit tests pass.

- [ ] T-014 Report build failures without leaving partial output
  - Satisfies: PRODUCT_SPEC.md §9 (build failure); §7 FR-06
  - Components: Command Interface, Configuration Loader, Content Store, Site Builder
  - Depends on: T-013
  - External boundary: no
  - Acceptance criteria:
    - With no Content Snapshot, `claytube build` exits non-zero with a build error and creates no Built Site.
    - With the site title missing, `claytube build` exits non-zero with an error naming the missing site title, as defined in ARCHITECTURE.md Section 9.
    - With missing or unreadable Project Configuration, `claytube build` exits non-zero with a configuration error naming the location.
    - If a build fails after an earlier successful build, the Built Site location holds the earlier complete Built Site, byte-identical; if no earlier Built Site existed, it holds nothing.
    - The Content Store is byte-identical after every failed build.
    - Unit tests pass.

- [ ] T-015 Reflect updated content after sync and rebuild
  - Satisfies: PRODUCT_SPEC.md §7 FR-08; §8 Flow 2; §11 criterion 9
  - Components: Sync Orchestrator, Content Store, Site Builder
  - Depends on: T-010, T-014
  - External boundary: no
  - Acceptance criteria:
    - After `claytube sync` discovers a new Video, the Built Site does not contain it until `claytube build` runs; after `claytube build`, it does.
    - A Video removed at the source is absent from the Built Site after `claytube sync` and `claytube build`.
    - `claytube sync` alone leaves the Built Site byte-identical.
    - `claytube build` alone leaves the Content Store byte-identical.
    - Tests use responses recorded in T-007 and T-009.
    - Unit tests pass.

- [ ] T-016 Publish the Built Site to GitHub Pages
  - Satisfies: PRODUCT_SPEC.md §7 FR-07; §11 criterion 8
  - Components: Command Interface, Publisher
  - Depends on: T-013
  - External boundary: yes (GitHub Pages)
  - Acceptance criteria:
    - With a complete Built Site and publication authorization in the execution environment, `claytube deploy` exits zero and the Built Site is published to GitHub Pages.
    - The content retrieved from the published site is identical to the Built Site.
    - The published output contains no Credential value and no other secret.
    - `claytube deploy` leaves the Content Store and the Built Site byte-identical.
    - `claytube deploy` succeeds when Project Configuration and the Content Store are unreadable.
    - A live observation of GitHub Pages publication behavior is recorded.
    - An E2E test against live GitHub Pages passes.
    - Unit tests pass.

- [ ] T-017 Report publish failures
  - Satisfies: PRODUCT_SPEC.md §7 FR-07; §9 (errors are presented, not ignored)
  - Components: Command Interface, Publisher
  - Depends on: T-016
  - External boundary: yes (GitHub Pages)
  - Acceptance criteria:
    - With no complete Built Site, `claytube deploy` exits non-zero with a publish error; the Hosting Target and the Built Site location are unchanged.
    - When GitHub Pages rejects publication, `claytube deploy` exits non-zero with a publish error naming the failed step; the Built Site, Content Store, and Project Configuration are byte-identical to before.
    - A live observation of GitHub Pages' response to rejected publication authorization is recorded.
    - An E2E test against live GitHub Pages passes for the rejected-authorization case.
    - Unit tests pass.

- [ ] T-018 End-to-end user flows
  - Satisfies: PRODUCT_SPEC.md §8 Flows 1–4; §11 criteria 1–10; §12 (Product Success)
  - Components: Command Interface, Project Initializer, Configuration Loader, Sync Orchestrator, Content Source Adapter, Content Store, Site Builder, Publisher
  - Depends on: T-004, T-012, T-015, T-017
  - External boundary: yes (YouTube, GitHub Pages)
  - Acceptance criteria:
    - From an empty location, using only the installed CLI: init, set the site title and one channel URL in Project Configuration, sync, build, deploy all exit zero, and the published site shows that channel's Videos; no source code is edited.
    - Adding a second channel URL and repeating sync, build, deploy publishes a site that also shows the second channel's Videos.
    - An invalid YouTube URL, a missing Credential, and a build failure each produce a non-zero exit and an explicit error.
    - The live observations recorded in T-004, T-007, T-009, T-016, and T-017 are re-observed and still match.
    - An E2E test of the full flow against the live YouTube and live GitHub Pages passes.
    - Unit tests pass.

---

## Future

Future tasks must not be implemented unless the human names them explicitly.

PRODUCT_SPEC.md defines no Future scope. The MVP is the entire product. This section has no tasks.
