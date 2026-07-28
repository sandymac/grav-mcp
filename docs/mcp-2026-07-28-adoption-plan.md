# grav-mcp: MCP 2026-07-28 Adoption Plan

**Status:** Proposed, not started
**Author:** Andy Miller
**Created:** 2026-07-28
**Spec:** [MCP 2026-07-28 Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)

---

## 1. Context

The MCP 2026-07-28 revision is the largest change to the protocol since launch. The
headline items relevant to this project:

| Change | Relevance to grav-mcp |
| --- | --- |
| Stateless protocol core (no `initialize` handshake, no `Mcp-Session-Id`) | High. Fixes a real multi-tenant defect in our HTTP transport and unblocks a PHP-native MCP endpoint. |
| Full JSON Schema 2020-12 in input schemas, unrestricted output schemas, `structuredContent` accepts any JSON | High. We currently return stringified JSON in text blocks for all 70 tools. |
| MCP Apps extension (server-rendered HTML in a sandboxed iframe) | High. Shipping today, independent of the RC. |
| Multi round-trip requests (`InputRequiredResult`) | Medium. Fits destructive-op confirmation and ETag conflict recovery. |
| `ttlMs` / `cacheScope` on list and resource responses | Medium. Pairs with the ETag support already in `GravClient`. |
| `server/discover` replaces the capability handshake | Medium, but SDK-driven. Mostly free once we upgrade. |
| W3C Trace Context in `_meta` | Low. Nice for hosted deployments. |
| Tasks moved from experimental core to an extension | Low. Deferred, see section 9. |
| Roots, Sampling, Logging deprecated (12-month window) | None. We use none of them. |
| Resource-not-found error code `-32002` becomes `-32602` | None. Our error mapping is HTTP-status based. |

### Where grav-mcp stands today

- `@modelcontextprotocol/sdk` **1.29.0** installed, **1.30.0** is latest on npm.
- No RC/2.x beta is published to npm yet (`dist-tags` has only `latest`). Anything
  that depends on the stateless core is **blocked on the SDK**, not on us.
- **70** tools across 11 domains (README and the project notes both say 67, that
  drifted), 5 resources, 6 prompts.
- Every tool returns `{ content: [{ type: 'text', text: JSON.stringify(...) }] }`
  via `toolResult()` in `src/tools/helpers.ts`.
- Zero `outputSchema` declarations, zero `structuredContent`.
- No use of roots, sampling, elicitation, or protocol logging.

### Guiding constraints

1. **No breaking changes for existing clients.** Every phase must leave the server
   working against hosts on the current protocol revision. Structured output and
   MCP Apps are both additive by design.
2. **Do not chase the SDK.** Phases 1 and 2 land against SDK 1.30.0. Phases 4 to 6
   wait for a published beta.
3. **Grav API stays the source of truth.** `scripts/audit-api-coverage.ts` keeps
   parsing `ApiRouter.php`. Nothing here changes that contract.

---

## 2. Phase 0: Correctness fixes (no spec dependency)

These are independent of the RC and should land first. Two are genuine defects.

### P0-1: Permission map leaks between callers on the HTTP transport

`src/server.ts:44` holds `initialized` as a closure flag, and `GravClient` caches
`access` and `isSuperAdmin` as instance state after a single `/me` call. `createServer()`
is invoked once in `main()`, so under `--transport http` **the first caller's resolved
permission map is applied to every subsequent request**, regardless of which API key
the request carried.

This is currently masked because the API key is process-level (`--key` / `GRAV_API_KEY`)
rather than per-request, so in practice every caller is the same identity. It becomes an
actual privilege leak the moment we accept per-request credentials, which is exactly what
Phase 5 introduces.

**Fix:** move permission resolution to per-request scope. Introduce a request context that
carries the credential and its resolved `access` map, and have `checkPermission` read from
that context rather than client instance state. For stdio the context is process-wide and
resolved once, so behaviour is unchanged.

**Files:** `src/server.ts`, `src/client/grav-client.ts`, `src/tools/helpers.ts`
(the `ensureInit` parameter threaded through all 10 `register*Tools` functions becomes a
context getter).

### P0-2: HTTP transport leaks a connection per request

In the `main()` HTTP branch of `src/index.ts`, the request handler constructs a new
`StreamableHTTPServerTransport` and calls `await server.connect(transport)` on **every
inbound request**, without ever closing it. Connections accumulate on the single `McpServer`
instance for the lifetime of the process.

**Fix:** either construct a fresh `McpServer` per request (correct for the stateless model,
and what Phase 5 wants anyway) or close the transport in a `finally`. Prefer the former so
it composes with P0-1.

### P0-3: Documented tool count is stale

README claims 67 tools, actual count is 70 (blueprints 6, config 3, gpm 9, media 8,
multilingual 5, pages 10, plugins 2, system 17, users 6, webhooks 4). Fix the README and add
a count assertion to the test suite so it cannot drift again.

### P0-4: Bump SDK 1.29.0 to 1.30.0

Routine. Run `npm run check` after.

**Phase 0 acceptance:** `npm run check` green; a test proves two different API keys hitting
the HTTP transport resolve independent permission maps; a test asserts the registered tool
count matches the documented number.

---

## 3. Phase 1: Structured output across all tools

The RC removes the restriction on output schemas and lets `structuredContent` hold any JSON
value. This is the highest value-per-hour item in the plan: agents currently have to re-parse
our pretty-printed JSON out of a text block, which costs tokens and invites parse errors.

### 3.1 Schema source of truth

`src/types/grav-api.ts` (426 lines) is hand-written TypeScript interfaces. Input schemas are
hand-written Zod. The two can drift.

**Proposal:** add `src/schemas/` containing Zod schemas for the API response types, and derive
the TypeScript types with `z.infer<>`. Retire the hand-written interfaces in
`src/types/grav-api.ts` incrementally as each domain is converted. One definition per type,
usable as both a TS type and a runtime output schema.

Do not attempt a big-bang conversion. Convert per domain, in the order given in 3.3.

### 3.2 Helper change

`toolResult()` in `src/tools/helpers.ts` gains an optional schema argument and emits both
representations:

```ts
export function toolResult(data: unknown, schema?: ZodTypeAny): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    ...(schema ? { structuredContent: data } : {}),
  };
}
```

Keeping the text block preserves compatibility with hosts that ignore `structuredContent`.
Revisit dropping it once adoption is broad, it is pure duplicated payload.

`addPaginationInfo()` currently reshapes the return value into `{ data, pagination }` only
when pagination metadata is present, which means list tools have two possible output shapes.
Under a declared output schema that has to become one consistent envelope. Make it always
return `{ data, pagination? }`.

**This is the one behavioural change in Phase 1 and it is visible to agents.** Note it in the
changelog.

### 3.3 Conversion order

| Order | Domain | Tools | Notes |
| --- | --- | --- | --- |
| 1 | pages | 10 | Highest traffic. `Page` / `PageSummary` are the most reused types. |
| 2 | media | 8 | Feeds the Phase 2 media picker. |
| 3 | system | 17 | Largest file, several one-off response types. |
| 4 | gpm | 9 | Feeds the Phase 2 package browser. |
| 5 | users | 6 | Watch for secrets, see 3.4. |
| 6 | blueprints | 6 | |
| 7 | multilingual | 5 | |
| 8 | webhooks | 4 | |
| 9 | config | 3 | `get_config` is genuinely arbitrary JSON, use a permissive schema. |
| 10 | plugins | 2 | `discover_plugins` is dynamic by design, permissive schema. |

### 3.4 Also worth doing in this pass

- **Tighten input schemas with `oneOf` / `anyOf`.** Now legal under JSON Schema 2020-12.
  Real candidates: media upload accepting base64 content XOR a URL (currently two optional
  fields and a convention), `create_page` requiring either a full `route` or `parent` plus
  `slug`, `manage_media_folder` and `manage_api_keys` which are action-dispatch tools where
  the valid parameter set depends on the action.
- **Use `$ref` to deduplicate.** The page header/frontmatter structure is repeated across
  `create_page`, `update_page`, and `batch_pages`.
- **Do not auto-dereference external `$ref` URIs.** The spec explicitly forbids it. Keep all
  refs local to the document.
- **Audit `users` and `config` output for secrets** before declaring a schema that promises
  to return them. `manage_api_keys` and `get_config` are the ones to check.

**Phase 1 acceptance:** every `registerTool` call has an `outputSchema`; unit tests assert
`structuredContent` validates against the declared schema for each tool; `npm run check`
green; README documents the pagination envelope change.

**Rough size:** the largest phase by line count, but almost entirely mechanical.

---

## 4. Phase 2: MCP Apps

`@modelcontextprotocol/ext-apps` is at **1.7.5** on npm and works against the SDK we already
have. This is available now and does not wait on the RC.

### 4.1 How it works

```ts
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE }
  from '@modelcontextprotocol/ext-apps/server';

registerAppTool(server, 'list_page_media', {
  title: 'List Page Media',
  description: '...',
  inputSchema: { /* unchanged */ },
  _meta: { ui: { resourceUri: 'ui://grav/media-browser.html' } },
}, handler);

registerAppResource(server, 'ui://grav/media-browser.html', 'ui://grav/media-browser.html',
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({ contents: [{ uri: '...', mimeType: RESOURCE_MIME_TYPE, text: html }] }));
```

Inside the iframe, an `App` instance receives the tool result via `app.ontoolresult` and can
call back into the server with `app.callServerTool()`.

Hosts that do not support the extension ignore `_meta.ui` and render the normal tool result,
so **every app must degrade to its text/structured output**. This falls out of Phase 1 for
free, which is why Phase 1 comes first.

### 4.2 Build pipeline

New requirement: the repo currently ships plain `tsc` output. UI bundles need their own step.

- Source in `ui/<app-name>/` (HTML plus TS plus CSS).
- Bundle each app to a **single self-contained HTML file** in `dist/ui/`. No external
  requests, the iframe is sandboxed.
- Add a bundler (esbuild is the lightest option, keeps `devDependencies` small and does not
  touch the `tsc` path for `src/`).
- `npm run build` becomes `build:server && build:ui`.
- Add `dist/ui` to the published `files` array in `package.json`.

Decide up front whether UI code is vanilla or a framework. Recommendation: **vanilla plus
esbuild** for the first two apps. These are small, and pulling a framework into a published
npm CLI for four widgets is not worth the install weight. Revisit if the blueprint form
renderer (4.3, App 5) goes ahead, that one may justify it.

### 4.3 Candidate apps, in build order

**App 1: Media browser** (`list_page_media`, `list_site_media`, `upload_page_media`,
`delete_page_media`)
Thumbnail grid with filename, dimensions, and size. Click to select, which returns the media
reference to the conversation. This is the clearest win. A JSON array of filenames is close
to useless for choosing an image, and picking images is a genuinely common task.

**App 2: Page diff and preview** (`get_page`, `update_page`)
Renders the current page against the proposed change before the write commits. Two panes:
frontmatter diff and content diff. Uses the `render: true` option on `get_page` for a visual
preview. Pairs naturally with the Phase 4 confirmation flow, and is useful on its own before
that.

**App 3: Package browser** (`search_packages`, `list_packages`, `check_updates`,
`install_package`)
Cards with description, version, author, and update status. Install and update buttons call
back via `app.callServerTool()`. Replaces what is currently a large text dump.

**App 4: Dashboard** (`get_dashboard_stats`, `get_dashboard_widgets`, `get_system_info`)
Actual charts instead of a statistics object. Lowest functional value of the four, highest
demo value.

**App 5 (stretch): Blueprint form renderer** (`get_blueprint`, `create_page`, `update_page`)
Render a Grav blueprint as a real form inside the iframe and let a human fill it in, then feed
the values back to the tool. This is the most interesting one because it stops the agent from
guessing at field values for templates it has never seen, and it reuses the conceptual work
already done in admin-next.

It is also the largest by a wide margin (Grav has a lot of field types) and would need a
supported-fields subset with a documented fallback. **Treat as a separate project, not part
of this phase.** Revisit after Apps 1 to 3 ship and we know how hosts behave in practice.

### 4.4 Risks

- **Host support is uneven.** Verify against at least Claude and one other client before
  claiming support in the README.
- **Extension versioning is independent of the spec.** Pin `@modelcontextprotocol/ext-apps`
  to a caret range and watch it separately.
- **Security review.** UI templates are prefetched and reviewed by the host. Keep them
  self-contained with no external fetches, same constraint we already work under elsewhere.

**Phase 2 acceptance:** Apps 1 to 3 built and bundled; each verified to degrade correctly on a
host without extension support; README documents which hosts render UI; `npm run check` green.

---

## 5. Phase 3: Response caching (`ttlMs` / `cacheScope`)

**Blocked on SDK support.**

The RC adds `ttlMs` and `cacheScope` to list and resource responses so hosts can cache without
an SSE stream. `GravClient` already tracks ETags, so the plumbing is half built.

Best candidates, all in `src/resources/index.ts`:

| Resource | Suggested TTL | Scope | Rationale |
| --- | --- | --- | --- |
| `grav://templates` | long | shared | Changes only when a theme or plugin is installed. |
| `grav://languages` | long | shared | Changes on config edit. |
| `grav://taxonomy` | short | shared | Changes as content is written. |
| `grav://system/info` | short | shared | Version and disk usage drift. |
| `grav://user/permissions` | short | **per-credential** | Must not be shared across callers. See P0-1. |

Also worth applying to `list_page_templates`, `get_permissions`, and `list_config_scopes`.

Add cache invalidation on the write path: any tool that installs a package or edits config
should signal that the affected resource is stale.

---

## 6. Phase 4: Multi round-trip requests

**Blocked on SDK support.**

`InputRequiredResult` lets a tool pause mid-call, ask the client for input, and resume when the
client retries with `inputResponses` and the echoed `requestState`. Two clear uses:

### 6.1 Destructive operation confirmation

Today these execute immediately and rely on the agent to have asked first:

`delete_page`, `delete_user`, `delete_page_media`, `delete_site_media`,
`delete_blueprint_file`, `remove_package`, `upgrade_grav`, `update_all_packages`,
`reorganize_pages`, `manage_media_folder` (delete action).

Each returns an `InputRequiredResult` describing exactly what will be destroyed (route,
username, file list, package name and version) and waits for confirmation. The confirmation
becomes in-band and auditable rather than a matter of agent politeness.

Add an opt-out (`--no-confirm` or an env var) for scripted and CI use.

### 6.2 ETag conflict resolution

`mapGravError` currently turns a 409 into a message telling the agent to "fetch the latest
version first to get a current ETag, then retry your update" (`src/client/error-mapper.ts:39-45`).
That is a dead end the agent has to recover from by itself.

Better: return an `InputRequiredResult` carrying the current server version, the attempted
change, and the choice of overwrite, merge, or abort. Combined with App 2 from Phase 2, the
conflict renders as a diff instead of an error string.

`requestState` must be self-contained since any server instance may process the retry. Do not
put anything in it that depends on process-local state.

---

## 7. Phase 5: Stateless core migration

**Blocked on an SDK beta being published to npm.**

Work items once the SDK lands:

1. **Remove handshake dependence.** The `ensureInitialized` pattern in `src/server.ts` exists
   because permissions were fetched once on connect. Under the stateless model there is no
   connect. Resolve per request from the credential in `_meta`. This is the same change as
   P0-1, so P0-1 is the down payment on this phase, not throwaway work.
2. **Adopt `server/discover`** for capability advertisement.
3. **Per-request credentials.** Today the API key is process-level. Stateless plus `_meta`
   client identity makes a genuinely multi-tenant HTTP deployment possible: one grav-mcp
   process serving many Grav sites or many API keys. This is the point at which P0-1 stops
   being theoretical.
4. **Emit `Mcp-Method` and `Mcp-Name` headers** so gateways can route without body inspection.
5. **W3C Trace Context** propagation in `_meta` (`traceparent`, `tracestate`, `baggage`).
6. **Rewrite the HTTP transport branch** of `src/index.ts` to construct per-request rather than
   reusing a long-lived connected server (see P0-2).
7. **Auth hardening.** If we go multi-tenant, revisit credential handling. `--key` on argv is
   visible in `ps` output, which is acceptable for a local stdio process and not acceptable for
   a hosted one. The RC's OAuth and OIDC alignment is the path if grav-mcp is ever hosted.

---

## 8. Phase 6 (parallel track): native MCP endpoint in grav-plugin-api

**Different repo, tracked here because the RC is what makes it viable.**

Removing the `initialize` handshake and session IDs turns MCP into plain stateless HTTP request
and response with `Mcp-Method` and `Mcp-Name` routing headers. No SSE, no session store, no
sticky load balancing. That was the specific thing making a PHP implementation awkward under
Apache and FPM.

A `POST /api/v1/mcp` route in `grav-plugin-api` would mean:

- No Node process and no separate deploy.
- Works on ordinary shared hosting, which is a large share of the Grav install base.
- Auth reuses the API key infrastructure that already exists.
- One less thing to keep in sync, since the router is already the source of truth
  (`scripts/audit-api-coverage.ts` exists precisely because it currently is not co-located).

grav-mcp then becomes the local, stdio, and development option rather than the only option,
and the two share a tool definition contract.

**This needs its own design document before any code.** Open questions: how tool definitions
are shared or generated between the PHP and TypeScript implementations, whether MCP Apps
templates can be served from PHP, and whether the api plugin wants this dependency at all.

---

## 9. Explicitly deferred

- **Tasks extension.** Graduated out of core to `ext-tasks`, still marked experimental, no npm
  package published. The natural candidates in grav-mcp are `install_package`,
  `update_all_packages`, `upgrade_grav`, `create_backup`, and `clear_cache` on large sites, all
  of which currently block the tool call. Revisit when the extension stabilises. Note that
  `tasks/list` was removed for safety in the stateless model, so any design must not depend on
  enumerating tasks.
- **Roots, Sampling, Logging.** All deprecated with a minimum 12-month window. We use none of
  them. Current `console.error` logging is exactly what the spec now recommends for stdio. **No
  action required**, recorded here so a future reader does not go looking.
- **Error code `-32002` to `-32602`.** Our error mapping (`src/client/error-mapper.ts`) works on
  HTTP status codes, not JSON-RPC codes. Handled by the SDK upgrade. **No action required.**

---

## 10. Sequencing

| Phase | Depends on | Blocked? | Ship independently? |
| --- | --- | --- | --- |
| 0: Correctness fixes | nothing | no | yes |
| 1: Structured output | Phase 0 | no | yes |
| 2: MCP Apps | Phase 1 (for graceful degradation) | no | yes, per app |
| 3: Caching | SDK | **yes** | yes |
| 4: Multi round-trip | SDK | **yes** | yes, per tool group |
| 5: Stateless core | SDK beta on npm | **yes** | no, one cutover |
| 6: PHP MCP endpoint | Phase 5 design settled | design first | separate repo |

Phases 0 to 2 are all actionable today and account for most of the user-visible improvement.
Phases 3 to 5 wait on the SDK. Phase 6 is a strategic bet that needs its own document.

Suggested first milestone: **Phase 0 plus Phase 1 pages/media domains plus App 1 (media
browser)**. That is a coherent, shippable release that fixes two defects and demonstrates the
new capability on the single most-improved workflow.

---

## 11. Open questions

1. Do we publish grav-mcp to npm before or after this work? Currently `0.1.0` and unpublished.
   Phase 1's pagination envelope change is easier before there are users.
2. Vanilla plus esbuild for MCP Apps, or pull in a framework? Recommendation is vanilla, but the
   blueprint form renderer (App 5) would change that calculation.
3. Is the PHP-native MCP endpoint (Phase 6) something we actually want in `grav-plugin-api`, or
   does it belong in its own plugin?
4. Does the confirmation flow in Phase 4 need to be configurable per tool, or is a single global
   opt-out enough?
5. Should `src/types/grav-api.ts` be fully replaced by Zod-derived types, or do we keep the
   hand-written interfaces for the shapes that never appear in tool output?
