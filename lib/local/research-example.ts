import { fields } from '../demo/records.ts';
import type { Field, FieldKey, Provenance, Snapshot } from '../demo/records.ts';
import type { Bundle } from './records.ts';

// Source-backed reconstruction, not a customer record or a causal diagnosis.
// Exact source rows were checked in meta/episodes/chunk-000/file-000.parquet.
export const flowstepsSource = {
  repository: 'https://huggingface.co/datasets/lucanunz/flowsteps',
  revision: '7b6a29a20c866ce3caaa4a5461a2c5ca873f8bc7',
  metadataSha256: '6d3fbfee2fa5451b7d2507fbe1748547d163f2c2ccc2cd3062007ce68707b278',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  credit: 'Shivakanth Sujit, Luca Nunziante, Rousslan Fernand Julien Dossa, Kai Arulkumaran (2026), Flowsteps / When One Step Is Enough',
  pairIndex: 1984,
} as const;

const evidence = `${flowstepsSource.repository}/blob/${flowstepsSource.revision}/meta/episodes/chunk-000/file-000.parquet`;
const known = (value: string | number): Field => ({ state: 'known', value });
const unknown = (reason: string): Field => ({ state: 'unknown', reason });

export type ResearchEpisode = {
  episode_index: number; pair_index: number; run_number: number;
  policy: string; num_euler_steps: number; success: number; tasks: string[];
};

const exampleEpisodes: ResearchEpisode[] = [
  { episode_index: 3969, pair_index: 1984, run_number: 1, policy: 'pi0.5', num_euler_steps: 10, success: 1, tasks: ['Put the spoon in the drawer'] },
  { episode_index: 3968, pair_index: 1984, run_number: 2, policy: 'pi0.5', num_euler_steps: 1, success: 0, tasks: ['Put the spoon in the drawer'] },
];

// One pair at a time: the source establishes within-pair order, not a global timeline.
export function researchExample(episodes: readonly ResearchEpisode[] = exampleEpisodes): Bundle {
  if (episodes.length !== 2 || episodes.some(e => !Number.isSafeInteger(e.episode_index) || e.episode_index < 0 ||
    !Number.isSafeInteger(e.pair_index) || e.pair_index < 0 || ![1, 2].includes(e.run_number) ||
    ![0, 1].includes(e.success) || ![1, 5, 10].includes(e.num_euler_steps) ||
    !['dit', 'flower', 'lap', 'pi0.5', 'xr-0', 'xvla'].includes(e.policy) ||
    e.tasks.length !== 1 || typeof e.tasks[0] !== 'string' || !e.tasks[0].trim()) ||
    episodes[0].pair_index !== episodes[1].pair_index || episodes[0].policy !== episodes[1].policy ||
    episodes[0].tasks[0] !== episodes[1].tasks[0] || episodes[0].run_number === episodes[1].run_number ||
    episodes[0].episode_index === episodes[1].episode_index) throw new Error('Expected one valid matched Flowsteps pair.');
  const ordered = [...episodes].sort((a, b) => a.run_number - b.run_number);
  const robotId = 'flowsteps-panda-example';
  // These are illustrative ordering placeholders. The source provides run_number,
  // not wall-clock execution times or a physical hardware confirmation timestamp.
  const makeSnapshot = (row: ResearchEpisode): Snapshot => {
    const { episode_index: episode, run_number: order, num_euler_steps: steps } = row;
    const at = `2026-01-01T0${order}:00:00Z`;
    const provenance: Provenance = {
      source: `Flowsteps pair ${row.pair_index}, episode ${episode}; CC BY 4.0`,
      method: 'Manual source transcription; all displayed dates are synthetic placeholders, not source observation times or hardware confirmations.',
      author: flowstepsSource.credit,
      observedAt: at, recordedAt: at, evidence, available: true,
    };
    const values = Object.fromEntries(fields.map(([key]) => [key,
      unknown('Not established by the inspected source metadata; no version, measurement or physical confirmation invented.'),
    ])) as Record<FieldKey, Field>;
    values.object = known(row.tasks[0]);
    // A policy family is not an exact checkpoint; preserve that distinction.
    values.model = unknown(`Policy label is ${row.policy}; exact deployed checkpoint hash is not established by the inspected metadata.`);
    values.procedure = unknown('Task instruction is available; an exact versioned procedure is not established.');
    const custom = (id: string, name: string, value: string | number, category: 'configuration' | 'condition' | 'measurement' = 'configuration') => ({
      id, component: 'Public research reference', name,
      type: typeof value === 'number' ? 'number' as const : 'text' as const,
      unit: typeof value === 'number' ? '1' : '', category,
      value: known(value), provenance: { ...provenance },
    });
    return {
      id: `flowsteps-episode-${episode}`, revision: 1, robotId, schemaVersion: 2,
      hardwareConfirmedAt: at, values,
      provenance: Object.fromEntries(fields.map(([key]) => [key, { ...provenance }])) as Record<FieldKey, Provenance>,
      custom: [
        custom('euler-steps', 'Euler integration steps', steps),
        custom('policy-label', 'Source policy label (not checkpoint identity)', row.policy),
        custom('robot-model', 'Reported robot model (not hardware revision)', 'Franka Panda'),
        custom('gripper-model', 'Reported gripper model (not hardware revision)', 'Robotiq 2F-85'),
        custom('pair-index', 'Source matched pair', row.pair_index, 'condition'),
        custom('episode-index', 'Source episode index', episode, 'measurement'),
        custom('run-order', 'Source execution order within pair', order, 'measurement'),
        custom('time-status', 'Demo timeline status', 'All displayed dates are invented ordering placeholders. Actual execution and hardware confirmation times are unknown.'),
        custom('license', 'Source license', flowstepsSource.license),
        custom('interpretation', 'Evidence limitation', 'Human-labeled task outcome. A changed setting is not proof of cause. This pair is illustrative, not representative performance.'),
      ],
    };
  };
  const snapshots = ordered.map(makeSnapshot);
  return {
    format: 'unify-local', version: 2, synthetic: true, corrections: [],
    records: {
      robots: [{ id: robotId, name: 'Franka Panda - public research reconstruction', task: `${ordered[0].tasks[0]} | real source outcomes; synthetic dates | CC BY 4.0` }],
      snapshots,
      runs: ordered.map((row, index) => ({
        id: `flowsteps-${row.episode_index}-${row.success ? 'success' : 'failure'}`, robotId,
        snapshotId: snapshots[index].id, snapshotRevision: 1,
        at: `2026-01-01T0${row.run_number}:01:00Z`, outcome: row.success ? 'success' : 'failure',
      })),
    },
  };
}
