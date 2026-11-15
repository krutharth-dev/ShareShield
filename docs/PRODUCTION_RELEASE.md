# ShareShield Pages release control

## Active target — verified 3 November 2026

Repository: `krutharth-dev/ShareShield`. Cloudflare Pages project: `shareshield-mini`. Production branch: `main`. Build root: `frontend`; command: `npm run build`; output: `dist`.

- Website: https://shareshield-mini.pages.dev
- Workspace: https://shareshield-mini.pages.dev/app
- Health: https://shareshield-mini.pages.dev/api/health
- Verified production deployment: `b4740070-ecd4-465a-a1d6-559356818eff`, commit `d5991e917e656e40fcf1f69c4f61cb3058f16385`.

The hackathon Workers were retired by the owner on 3 November. Do not recreate or reuse them. No Render service is part of this deployment. The optional Python/Tesseract service is not hosted by Pages; the active processing mode is browser-local.

## Preview acceptance and promotion

1. Preserve main and production. Base changes on the latest reviewed mini-project branch.
2. Run exact-head frontend tests, typecheck, build, Python/redaction tests, Pages Functions compilation and browser/download acceptance.
3. Request an isolated Pages branch preview in the existing project. Verify its environment is preview, final stage is success and metadata identifies the expected exact commit. Queued/idle records do not establish deployment.
4. Test synthetic input through detection, manual approval/restore, true exported redaction, reopened-output preview, download and independent byte inspection. Record FLAG when required content remains and UNVERIFIED when required evidence is incomplete.
5. Obtain required reviews and explicit owner release authorization before merging or deploying production.

Production Git builds are currently enabled on main; automatic preview Git builds are disabled. A manual preview request can be made independently. **The manual workflow is not the sole enforcement boundary:** merging main may trigger Cloudflare directly. Respect branch protection and owner approval. This repair changes no Cloudflare settings, secrets, access policies or billing.

## Corrected manual workflow (prepared, not dispatched)

`.github/workflows/cloudflare-manual-release.yml` requires main, `reviewed=true`, and the GitHub production environment. It installs locked Node dependencies, runs tests/typecheck/build, compiles Pages Functions and deploys the reviewed commit to the existing Pages project:

```sh
npx wrangler pages deploy dist --project-name shareshield-mini --branch main --commit-hash "$GITHUB_SHA" --commit-dirty=false
```

The current workflow runs frontend validation. Require successful backend and browser acceptance workflows on the exact reviewed main commit as separate release evidence. GitHub environment reviewer configuration and release secrets have not been verified here. It needs an existing Pages-edit token and account ID in GitHub secrets; no secret is created by this repair.

After an authorized release, compare Cloudflare's canonical deployment and source SHA with the reviewed commit, then repeat synthetic acceptance on the public URL. HTTP 200 is not evidence of redaction correctness. No production release was dispatched by this continuation.

## Costs and limits

No new paid service, container, database or storage is provisioned. Existing Cloudflare limits apply. Cloudflare Containers for native Python remain a separate cost-approved proposal. Trained multilingual recognition, reliable handwriting, broad private-document recall and guaranteed privacy are not established by a successful preview or build.
