"""Extract only public outcome/configuration metadata, never robot recordings.

Requires duckdb in the invoking Python environment. Source bytes are pinned;
changing the dataset requires explicit review, not silently refreshed expectations.
"""
import argparse
import hashlib
import json
from pathlib import Path
import duckdb

parser = argparse.ArgumentParser()
parser.add_argument('parquet', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
digest = hashlib.sha256(args.parquet.read_bytes()).hexdigest()
expected = '6d3fbfee2fa5451b7d2507fbe1748547d163f2c2ccc2cd3062007ce68707b278'
if digest != expected:
    raise SystemExit('Source SHA-256 mismatch; refusing to replace expected evidence.')
columns = ['episode_index', 'pair_index', 'run_number', 'policy', 'num_euler_steps', 'success', 'tasks', 'length']
rows = duckdb.connect().execute(
    'SELECT ' + ','.join(columns) + ' FROM read_parquet(?) ORDER BY episode_index',
    [str(args.parquet)]).fetchall()
if len(rows) != 4800:
    raise SystemExit('Unexpected source row count.')
data = {
    'source': 'https://huggingface.co/datasets/lucanunz/flowsteps',
    'revision': '7b6a29a20c866ce3caaa4a5461a2c5ca873f8bc7',
    'metadataSha256': digest,
    'license': 'https://creativecommons.org/licenses/by/4.0/',
    'credit': 'Shivakanth Sujit, Luca Nunziante, Rousslan Fernand Julien Dossa, Kai Arulkumaran (2026), Flowsteps / When One Step Is Enough',
    'adaptation': 'Selected public episode metadata columns only. No timestamps or physical failure causes inferred. No endorsement implied.',
    'columns': columns,
    'rows': rows,
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(data, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'Extracted {len(rows)} source rows; SHA-256 {digest}')
