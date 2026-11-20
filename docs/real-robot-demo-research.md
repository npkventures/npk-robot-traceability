# Real robot example for the local demo

Research checked 2026-11-17. Authority: [build.md sections 1, 2 and 6](../build.md). This is a public-research reconstruction, not customer evidence, a verified root cause, or a deployment claim.

## Recommended example: spoon placement with a Franka Panda

The [Flowsteps dataset](https://huggingface.co/datasets/lucanunz/flowsteps) accompanies [When One Step Is Enough](https://onestepflow.github.io/). It contains physical-robot rollouts with matched A/B settings, human outcome labels and explicit pair/execution-order metadata. That makes it a stronger comparison example than a standalone failure clip.

Inspected exact release `7b6a29a20c866ce3caaa4a5461a2c5ca873f8bc7`, file `meta/episodes/chunk-000/file-000.parquet`, SHA-256 `6d3fbfee2fa5451b7d2507fbe1748547d163f2c2ccc2cd3062007ce68707b278`.

| Published field | Successful execution | Failed execution |
| --- | --- | --- |
| Episode index | 3969 | 3968 |
| Pair index | 1984 | 1984 |
| Run number within pair | 1 | 2 |
| Task | Put the spoon in the drawer | Put the spoon in the drawer |
| Policy label | pi0.5 | pi0.5 |
| Euler integration steps | 10 | 1 |
| Human success label | 1 | 0 |

Do not sort these by episode index: the source's run number establishes execution order. The reported platform is Franka Panda with a Robotiq 2F-85. An exact checkpoint, code revision, firmware revision, calibration revision, physical confirmation time and wall-clock run times were not established by the inspected metadata. They must not be invented as source facts.

This is a selected discordant pair, not representative performance. The [authors' overall results](https://onestepflow.github.io/#results) do not establish that more integration steps are generally better. Do not claim the setting caused this individual failure, or describe a slip/missed grasp without inspecting its footage. No video was visually reviewed in this task.

## Reuse and attribution

The dataset card and repository API declare **CC BY 4.0**. The [license](https://creativecommons.org/licenses/by/4.0/) permits commercial sharing and adaptation subject to attribution, a license link and disclosure of changes. It does not grant endorsement, trademark or privacy rights; do not use researcher/company logos as customer proof. This verifies the published permission basis, not an independent chain-of-title opinion.

Credit accompanying this reconstruction:

> Source: Shivakanth Sujit, Luca Nunziante, Rousslan Fernand Julien Dossa and Kai Arulkumaran (2026), Flowsteps / When One Step Is Enough. CC BY 4.0. Source episode metadata adapted into Tavrik example records; dates and internal record IDs are illustrative. No endorsement implied.

Preserve the dataset link, pinned revision and license link with redistributed records. The application fixture carries source credit and evidence references in provenance and a license URL as a custom field. Only selected metadata and references enter the application; no raw videos, weights or dataset archive are shipped.

## Alternatives checked

| Candidate | Assessment |
| --- | --- |
| [Oopsie Aloha ball grasp](https://oopsie-data.com/) | Very relatable success/failure demonstration; [contribution terms](https://oopsie-data.com/license/) specify CC BY 4.0. Exact clip attribution/version remains to be established before copying its media. |
| [UCI Robot Execution Failures](https://archive.ics.uci.edu/dataset/138/robot+execution+failures) | Explicit CC BY 4.0 and useful force/torque traces; older data and less suitable for a modern visual comparison. |
| [Toyota HSR handle grasping](https://pub.h-brs.de/frontdoor/index/index/searchtype/collection/id/116/rows/20/start/2/yearfq/2021/nav/next) | Institutional record declares CC BY 4.0 and describes ground-truth annotations. Exact trial pair not inspected. |
| [AURSAD screwdriving](https://zenodo.org/records/4559556) | Strong industrial relevance; page extraction did not expose an explicit dataset license. Do not substitute the loader code's license. |
| [voraus-AD](https://github.com/vorausrobotik/voraus-ad-dataset) | Excellent industrial fit, but original dataset is CC BY-NC-SA 4.0 despite MIT code. Not selected for a commercial product demo without additional permission. |
| [Haptal failure benchmark](https://huggingface.co/datasets/HaptalAI/robotics-failure-benchmark) | Describes physics-based injected failures; does not meet the requested actual physical-failure evidence standard. |

## Run locally

From the repository root, with Node 22.18+ on PATH:

```sh
npm run dev
```

Open `http://127.0.0.1:3000/workspace/?example=flowsteps` and click **Load synthetic example**. If Next reports a different port, use that port. Choose target `flowsteps-3968-failure` and baseline `flowsteps-3969-success`. Inspect the Euler-step difference, unknown configuration, source episode IDs and provenance. The normal URL without this query still loads the original synthetic example; `/demo/` remains unchanged.

On this Windows workspace, if npm is not on PATH, first run:

```powershell
$env:PATH="$PWD/.tools/node-v24.21.0-win-x64;$env:PATH"
npm.cmd run dev
```

The reconstructed bundle stays `synthetic: true` because this format requires timestamps that the inspected source does not provide. All displayed January 1 dates are invented ordering placeholders, explicitly disclosed in the load message, provenance and custom fields. No pick counts, hardware versions or causal resolution are fabricated. Export/import preserves the references; edits stay synthetic. The existing workspace layout is reused without a visual redesign. SonarGrid and scroll reveal were subsequently implemented under a scoped direct-code exception; the separate app-logo design remains pending Paper.

## Source-based correctness validation, 2026-11-17

The continuation retained Flowsteps because its matched settings and human labels support a more rigorous check than an isolated failure video. The source card notes that its corresponding Oopsie release loses A/B pairing. The selected spoon pair is useful for demonstration, but the correctness evaluation uses **all 4,800 episodes / 2,400 pairs**, not just that favorable example.

`scripts/extract-flowsteps.py` verifies the exact Parquet SHA-256 above before extracting eight allowlisted public metadata columns to `tests/fixtures/flowsteps-metadata.json`. The fixture includes attribution, license, pinned revision and adaptation notice. No camera frames, trajectories, raw recordings or model weights are included. Extraction requires DuckDB; it is a research tool, not an application dependency. Normal regression tests run offline using the checked-in metadata.

```sh
python scripts/extract-flowsteps.py path/to/verified-episodes.parquet tests/fixtures/flowsteps-metadata.json
node --experimental-strip-types --test tests/flowsteps-validation.test.mjs
```

The source totals are 2,740 successes and 2,060 failures. Counting within-pair execution order gives:

| Source outcome pattern | Pairs |
| --- | ---: |
| Both succeed | 1,174 |
| Both fail | 834 |
| Success then failure | 206 |
| Failure then success | 186 |

Among discordant pairs, 199 succeed only with one step and 193 only with the higher setting. These descriptive counts are not a causal estimate or a prediction-accuracy score.

The regression validates each pair independently through the same record constructor, strict import validator, comparison, investigation analysis, baseline selection, failure review and handoff used by the product. It checks exact source outcomes and episode references, the numeric Euler-step change in either direction, nine unknown core fields, comparability warnings, unchanged input records, and abstention from unsupported baseline/repeated-cause claims. Each pair gets explicitly synthetic within-pair times; pairs are never joined into an invented global history. The default demo is checked against the independently extracted rows for pair 1984.

One feedback defect was found: changed source episode/order measurements were counted as leads to retest. The checklist now separates configuration/condition differences from measurement differences. All three recorded changes remain visible, while the selected pair has **one configuration lead and two measurement differences**. A measurement-only difference does not trigger a configuration-retest recommendation. Unknown fields never become verified unchanged fields.

Browser coverage exercises the selected source pair at mobile/desktop sizes, manual baseline selection with warnings, rejection of evidence-free confirmation, an explicitly unresolved investigation, text/JSON report exports, failure-review export and exact export/reimport. A separate isolated database check appends the same bundle, retries idempotently, denies a viewer write and retrieves history before comparing the resulting analysis with the original. See the progress log for final execution results and broader regression checks.

### What this establishes and what it cannot establish

This is a retrospective check of **recorded-change correctness and honest uncertainty** against published human labels. The software imports those labels; it does not independently discover success/failure from video. The dataset does not provide a confirmed individual failure cause, so no root-cause accuracy, prospective failure-prediction accuracy or repaired-robot performance is claimed. The paired design does not eliminate unmeasured real-world variation. Video has not been visually reviewed in this validation; use the human outcome labels as attributed source evidence.

Broader software regression tests use synthetic fixtures, isolated databases and simulated providers. They do not verify live OAuth, real robot control, operational recovery, deployed hosting or customer value. The source example remains available locally at `/workspace/?example=flowsteps`; the public `/demo/` remains the original labeled synthetic example.
