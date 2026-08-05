# 1ATF Portal — handover brief

**Written 2026-08-04.** Audience: the next engineer or AI session picking this
up. Read [CLAUDE.md](CLAUDE.md) first for architecture, then
[CHANGELOG.md](CHANGELOG.md) for what recent sessions actually changed, then
this for what is still outstanding.

Keep this file current: move items out as they land rather than letting it rot
into a list of things that were already done.

---

## 0. Read this first — the one thing that blocks everything

**`firestore.rules` in the repo has NEVER been republished to the Firebase
Console.** The live project is still running an older ruleset. This is a manual
console action nobody has done, and it is the single highest-value task here.

Five separate changes are stuck behind it:

| Block | Consequence of not republishing |
|---|---|
| `campaignFrames` | **RHQ cannot write campaign frames at all** against live Firebase. The whole replay-authoring flow is dead in production. |
| `intelStats` | Every anonymous decrypt count is rejected. Writes are deliberately swallowed, so the puzzles still work — the Ops Centre "Decrypts" panel just reads zero forever, which looks like "nobody is playing" rather than "this is broken". |
| `intelSubmissions` | The COY-intel approval workflow doesn't work live. |
| `roster` read lockdown | Roster reads are still on the old, looser rule (RHQ + own-record only is what the repo has). |
| `isRHQStaff` (2026-08-05) | **RHQ Staff accounts cannot approve anything live.** The role exists, the UI works, but publishing an approved fragment writes `content/intel` and clears `intelSubmissions` — both denied for that role until the republish. |

**How to do it:** Firebase Console → Firestore → Rules → paste
[firestore.rules](firestore.rules) → Publish. No code change needed.

### While you're in there: Storage (added 2026-08-04)

The Briefings editor now takes a **dragged-in video file**, which is the app's
only use of Cloud Storage. It needs its own two console actions:

1. **Storage → enable the default bucket.** Firebase requires the **Blaze**
   plan for this on projects created after Oct 2024, and the bucket name in
   [config.js](src/firebase/config.js) (`…firebasestorage.app`) is the
   post-Oct-2024 format, so expect a billing prompt. If that's not acceptable,
   the feature simply stays unavailable — RHQ pastes a YouTube link exactly as
   before, and the drop zone says so rather than failing silently.
2. **Storage → Rules → paste [storage.rules](storage.rules) → Publish.**

Failure mode until both are done: `storage/unauthorized`, surfaced in the drop
zone as "Firebase Storage may not be enabled… paste a video link instead".
Nothing else on the site is affected.

**Verify after publishing**, in this order:
1. Sign in as RHQ (`190990`), Ops Centre → Map: Territory → add a campaign
   frame. It should persist across reload.
2. On the public Intel tab, solve a fragment. Ops Centre → Intercepted
   Intelligence → Decrypts → Refresh should show 1.
3. Sign in as a Company Commander, submit an intel change, approve it as RHQ.
4. Ops Centre → Briefings → drag an MP4 into the drop zone. It should upload,
   preview, and survive Save + reload on the public `/briefings` tab.
5. As 190990, create an **RHQ Staff** user. Sign in as them, open
   `/staff-centre` → Approvals, and approve a commander's submission. Confirm
   they are bounced from `/operations-centre` and `/company-command`.

---

## 1. Rules that have never been emulator-tested

An earlier session verified `content/*`, `roster` and `intelSubmissions`
against the real rules engine (`firebase-tools` Firestore emulator +
`@firebase/rules-unit-testing`, 19 checks). **That test suite was never
committed** — there is no reproducible rules test in this repo. Worth
rebuilding, because two blocks have since been added blind:

### `campaignFrames`
Mirrors the already-verified public-read/RHQ-write shape exactly. Low risk, but
untested.

### `intelStats` — **test this one properly**
This is the only rule in the entire ruleset that grants an **unauthenticated
caller a write**. It has to: the Intel tab has no login, so there is no
identity to gate on. It is shape-pinned instead.

```
allow create: statsShapeOk(...) && solves == 1
allow update: statsShapeOk(...) && solves == resource.data.solves + 1
              && company and fragmentId unchanged
```

It depends on the rules engine seeing `FieldValue.increment()` **already
resolved** in `request.resource.data`. That is documented Firestore behaviour
but has not been exercised here. If it does not hold, every write silently
fails (they're swallowed by design) and counts stay at zero — indistinguishable
from "the rules aren't published yet", so **do task 0 first or you'll chase a
ghost**.

Cases the emulator test must cover:
- create with `solves: 5` → **denied**
- update with `+2`, or `-1` → **denied**
- update that rewrites `company` or `fragmentId` → **denied**
- any extra field → **denied**
- a legitimate `setDoc({...}, {merge:true})` + `increment(1)` → **allowed**,
  both on create and on update
- delete by a non-RHQ caller → **denied**

Threat model, so nobody over-reacts to it: the worst an abusive client can do
is inflate one counter one request at a time. It cannot forge a total, move a
count between companies, or read anything private (the docs contain no
identity — see §2). The Ops Centre panel already labels it an engagement
signal, not a score. **Do not turn it into a public scoreboard without
revisiting this**, because a visible score is a much stronger reason to cheat.

---

## 2. Privacy posture — what is true today

Public tabs have **no accounts**. Two things are stored per device in
`localStorage` and never transmitted: chosen company, pages seen, and which
intel fragments have been decrypted.

The **only** thing the public pages send is the `intelStats` counter:
`{ company, fragmentId, solves, lastAt }`. No name, no ID, no login, no device
identifier. It is deduped client-side (first solve per device only), so it
counts devices, not people.

[src/pages/Privacy.jsx](src/pages/Privacy.jsx) documents this in a "Decrypt
counts" section. **If the shape of that record ever changes, update the notice
in the same commit.** It is a static repo-versioned page precisely so it can't
drift silently.

### Open gaps (known, accepted, not yet fixed)
- **The shared Staff Centre password is world-readable** (2026-08-05). It lives
  in `content/staffAccess`, and `content/*` is public-read so the signed-out site
  works. This is not a regression — it was previously compiled into the JS
  bundle, which is equally readable — but it does mean the latch cannot be made
  into a lock without moving the Staff Centre behind real auth. `Staff` /
  `RHQ Staff` accounts exist for anyone who needs actual authority.
- **Temp passwords are stored plain text** in the `roster` collection.
  Consider hashing and only revealing at generation/download time.
- **Residual own-record leak**: an *unregistered* member who knows their own ID
  can register, then read their own roster record's plain-text `tempPassword`
  via the own-record read path. Inherent to storing temp passwords in clear;
  fixed by the item above.
- **Intel has no confidentiality by design.** The whole `intel` slice ships to
  every browser — every company's `answer` and `reveal`. The company switcher
  on the Intel page makes this a one-click "bypass", not even a devtools one.
  This is fine for a game; it means **nothing company-sensitive can ever go in
  a fragment**, and the narrative must not depend on secrecy. A real fix needs
  per-company docs + auth, which the no-login design deliberately rejects.

---

## 3. Built but NOT browser-verified

Everything below compiles and, where it was pure logic, was checked with a
throwaway Node harness. **None of it has been driven in a real browser** —
there is no browser automation in this environment. This is the highest-value
QA pass available.

### Campaign replay + map (2026-08-04)
- **Timeline rail** ("train line") in
  [CampaignReplayMap.jsx](src/components/CampaignReplayMap.jsx) — bubble per
  frame, hover names it, click cuts to it instantly, PLAY resumes from the
  frame on screen (only restarts from the default start when already at live).
  Check: bubble hover labels, mid-play bubble click snapping, rail fill.
- **Derived company labels** ([companyLabels.js](src/lib/companyLabels.js)) —
  pole-of-inaccessibility placement. *Verified by harness*: largest-blob
  selection, U-shaped holdings landing inside the shape, tiny holdings
  suppressed. **Not** verified against the real NSW grid — check labels don't
  collide with place beacons or land on ocean-adjacent slivers.
- **Map key** ([MapLegend.jsx](src/components/MapLegend.jsx)) — static full
  roster, hatch swatches from the same renderer as the map fill.
- **Exports** ([replayExport.js](src/lib/replayExport.js)) — both need a real
  run: the MP4 and the weekly PNG. See §4.

### Intel (2026-08-04)
- Decrypt meter, ✓ ticks, hint button, answer-box behaviour (space to advance,
  paste-to-spread, Enter to submit) — **test the paste and focus behaviour on a
  phone**, that's where it's least certain.
- "Preview as recruit" in both editors.
- Telemetry end-to-end (blocked on §0).

### Staff roles & RHQ Staff approvals (2026-08-05)
[ApprovalsQueue.jsx](src/components/ApprovalsQueue.jsx), the two new roles, and
the `staffAccess` password slice. Untested in a browser; the approval path can't
be tested against live Firebase until §0 is done. Worth driving:
- an RHQ Staff account **cannot** reach `/operations-centre` or
  `/company-command` (both should show the clearance-denied screen)
- a non-190990 RHQ opening an existing staff user: role select shows the current
  role and is **disabled**, and saving does not change it
- Ops Centre → Approvals and Staff Centre → Approvals behave identically now
  they share a component — check the "Review / edit first" sub-view header and
  its back button in BOTH
- changing the staff password in Users actually locks out the old one (the gate
  reads live slice state, so an open tab picks it up on reload)
- `staffAccess` with an empty/missing password: must fail closed, not open

### Home (2026-08-04)
- Recent Movements box + its ops editor; merged Meridian box.

### Briefings video drag-and-drop (2026-08-04)
[VideoDropZone.jsx](src/components/VideoDropZone.jsx) /
[videoUpload.js](src/lib/videoUpload.js). Only `resolveVideo()` was checked
with a throwaway harness (Storage/blob/YouTube/Vimeo/extension cases). Untested
in a browser, and the upload path cannot be tested at all until Storage is
enabled (§0). Specifically worth driving:
- drag enter/leave counting — nested children fire `dragleave`, hence the depth
  counter; check the highlight doesn't flicker
- dropping a **link** rather than a file (drag a YouTube tab's address bar)
- Cancel mid-upload, then re-drop the *same* file (the file input is reset for
  exactly this)
- the window-level drop guard: drop a file on the sidebar and confirm the
  browser does **not** navigate away from the editor

---

## 4. Known-shaky areas

### MP4 export — intermittently produced 0-byte files
**Not reproduced, not confirmed fixed.** Mitigations applied in
`exportCampaignReplay`:
- first frame drawn *before* `captureStream()` + `recorder.start()`
- **recorder paused and clock stopped while the tab is hidden** — this is the
  most likely root cause: `requestAnimationFrame` halts in a backgrounded tab,
  so the canvas froze while the recorder kept running
- `recorder.onerror` surfaced, `requestData()` before `stop()`, `stop()`
  guarded so a throw can't hang the outer promise
- **explicit error instead of a silent 0-byte download** if the blob is empty,
  naming backgrounding as the cause when that's what happened

If it recurs: the new error message should say which case it was. Next step
would be `captureStream(0)` + manual `track.requestFrame()` per painted frame,
which removes the compositor from the loop entirely.

### Chrome "Save ID card" prompt on intel answer boxes
Chrome's identity-document autofill was classifying an answer box as a document
number field. Suppressed with explicit `name`/`id`/`title` naming each box a
decrypted word, plus `data-1p-ignore` / `data-lpignore` /
`data-form-type="other"`. `autoComplete="off"` alone does **not** cover that
path.

**This is heuristic suppression, not a switch** — Chrome's classifier is
ML-driven with no documented page-level opt-out. If a future Chrome misfires
again, the only certain fix is not using `<input>` here (masked
`contentEditable` spans), which costs mobile keyboard behaviour and some
accessibility. Don't do that pre-emptively.

### Ops Users dialog / Chrome contact autofill
Fixed with `autoComplete="off"` on every field. Worth knowing *why* it
mattered: that dialog holds **another cadet's** name, ID and email, so
accepting the prompt would file a member's details into the RHQ staffer's
personal Google autofill profile and sync it to their account. If new personal
fields are added to that dialog, they need the same attribute.

---

## 5. Agreed but not built — intel roadmap

Context for the priorities: **intel fragments are a fun optional side
activity, not a delivery channel for must-know unit admin.** The user confirmed
this explicitly. It is why hints are opt-in with no forced reveal, and why
nothing critical may sit behind a puzzle. If a reveal ever starts carrying real
logistics (parade times, kit lists), that decision has to be revisited — being
stuck would start costing attendance.

In rough priority order:

1. **Encoder helpers in the intel editor.** Every cipher is currently
   hand-encoded outside the app and pasted in — slow, and a typo makes a
   fragment unsolvable (you find out from a confused cadet). Type the
   plaintext, pick Morse / Caesar / A1Z26 / reversed, and have it fill the
   prompt *and* the answer together so they cannot disagree. Highest leverage:
   an optional feature dies the moment authoring feels like work.
2. **Duplicate a fragment.** The same tasking for six companies is six full
   re-entries today. `MapEditor` already has a Duplicate pattern to copy.
3. **Map tie-in.** An optional `placeId` on a fragment pointing at a
   `territory.places` entry, rendering a mini-map with that beacon lit. The two
   strongest things in the app currently never touch, and a side activity lives
   or dies on feeling part of the world.
4. **Pacing.** No scheduled release, no expiry, no ordering.
   [SchedulePicker.jsx](src/components/SchedulePicker.jsx) already exists for
   video distribution and is reusable. Without expiry the tab becomes a
   graveyard of dead parades, which kills the "new intercept" feeling
   `useUnseenIntel` works hard to create. Each fragment already carries an
   unused `ts`.
5. **Rejection reasons.** [SubmissionsEditor](src/pages/ops/SubmissionsEditor.jsx)
   deletes a dismissed submission outright — the commander gets no reason and
   no trace, so they re-submit the same thing.
6. **Public per-company scoreboard.** Discussed, deliberately deferred. Would
   fit the campaign framing (Alpha 12, Bravo 5) but see the caveat in §1: a
   visible score is a much stronger incentive to inflate the counter than a
   private engagement signal is.

---

## 6. Cleanup / debt

- **[src/lib/docToQuiz.js](src/lib/docToQuiz.js) is fully dead** — exported
  nowhere. It's the remains of an "upload a doc → generate a quiz" feature.
  Wire it into the intel editor or delete it; dead code in a repo this size
  misleads the next session.
- **`Tasks.jsx` and `Activity.jsx` are unrouted** and unreachable. `Profile.jsx`
  is alive *only* as the home of the shared `PageTitle` export — the Profile
  page component itself is unrouted too. Their `tasks`/`activity` data-layer
  plumbing and admin surfaces still exist. Decide: revive or remove.
- **`leaflet` / `react-leaflet` are unused dependencies.** The map is a custom
  canvas grid. Only leftover CSS in [index.css](src/index.css) references them.
  Removing the deps would cut the bundle meaningfully.
- **No test suite at all.** No runner, no test dependencies, no CI checks
  beyond the Pages build. Note that CHANGELOG entries reference test "suites"
  and check counts (e.g. "167 checks total") — **none of those were ever
  committed**; they were throwaway harnesses run in-session and deleted. Don't
  go looking for them. The rules emulator suite (§1) is the highest-value
  thing to add first, and the first one that should actually be committed.
- **Bundle is ~1.38 MB** (395 KB gzipped) in one chunk, no code splitting.
  Firebase is statically imported in `config.js` while being dynamically
  imported elsewhere, which defeats the splitting the dynamic imports intend —
  see the build warning.

---

## 7. Parallel-session hazard (this actually happened)

On 2026-08-04 two sessions built **the same feature independently** — territory
ownership labels — and the second one only found out when `git push` was
rejected. The merge kept one implementation and discarded the other's on-screen
layer, plus a chunk of CSS and a `territory.js` function.

Before starting anything substantial: `git fetch && git log --oneline HEAD..origin/main`.
Push early rather than accumulating a large local branch. If a push is
rejected, **read the remote commit before resolving** — the one in this case
also carried an unrelated bug fix (modal stacking contexts) that a force-push
would have silently destroyed. Never force-push this repo.

## 8. Deploy — the trap

- Deploy branch is **`main`**; every push triggers the Pages build.
- ⚠️ [.github/workflows/deploy.yml](.github/workflows/deploy.yml) uses
  `concurrency: { group: pages, cancel-in-progress: true }`. **Rapid successive
  pushes cancel each other's in-flight deploy**, so the live site can silently
  stay on an old build with no error anywhere. Push one commit, then check the
  Actions tab shows conclusion = `success` (not `cancelled`) before pushing
  again.
- Served from the root of a **custom domain**: build uses `VITE_BASE=/` and
  `public/404.html` keeps 0 path segments. Both must be reverted (to
  `/<repo>/` and 1) if the custom domain is ever removed.
- The custom domain must also be in Firebase Auth → Settings → **Authorized
  domains**, or sign-ins fail there while working fine locally.
- Local dev against production data is the default. Set
  `VITE_FIREBASE_DISABLE=1` in `.env.local` for LOCAL MODE (localStorage) to
  avoid touching live content while testing.
