"""负责核对三项已提交登记的真实来源、冻结字节与完整矩阵增量；只读候选，不执行产品。"""
import copy
import hashlib
import json
import subprocess
from pathlib import Path

PREFIX = 'docs/refactor/generated/state-death-delivery-ledger-'
BASE = '96d3d0272392f8ad625ece176cee36df6dd789ea'
MATRIX = Path('docs/refactor/generated/current-mechanism-migration.json')

def ensure(condition, label):
    if not condition:
        raise ValueError(label)

def sha(value):
    return hashlib.sha256(value).hexdigest()

def blob(commit, path):
    return subprocess.check_output(['git', 'show', commit + ':' + path])

raw = Path(PREFIX + 'before.json').read_bytes()
before = json.loads(raw)
current = json.loads(MATRIX.read_bytes())
additions = json.loads(Path(PREFIX + 'additions.json').read_bytes())
ensure(raw == blob(BASE, str(MATRIX)), 'before_matrix_actual_git')
expected = copy.deepcopy(before)
by_name = {row['name']: row for row in expected['rows']}
changed = []
commits = []
for addition in additions:
    cell = by_name[addition['row']]['cells'][addition['column']]
    ensure(cell['status'] == 'pending', 'original_selected_status:' + addition['row'])
    cell['status'] = 'partial'
    cell['deliveredParts'].append(addition['part'])
    cell['remainingRequirements'].append(addition['remaining'])
    changed.append({'row': addition['row'], 'column': addition['column'], 'beforeStatus': 'pending', 'afterStatus': 'partial'})
    commit = addition['part']['commit']
    subprocess.run(['git', 'merge-base', '--is-ancestor', commit, BASE], check=True)
    name = {'noble_secret_body': 'noble-body-state-slot', 'mist_raven': 'mist-caster-state-slot', 'wolf_beauty': 'wolf-beauty-death-wave'}[addition['row']]
    scope_path = 'docs/refactor/generated/' + name + '-scope-final.json'
    scope_bytes = blob(commit, scope_path)
    scope = json.loads(scope_bytes)
    sources = []
    for source in scope.get('source', scope.get('files', [])):
        committed = blob(commit, source['path'])
        ensure(sha(committed) == source['sha256'], 'committed_source_scope:' + source['path'])
        actual = Path(source['path']).read_bytes()
        sources.append({'path': source['path'], 'committedSHA256': sha(committed), 'capturedCurrentSHA256': sha(actual), 'capturedCurrentSameCommit': actual == committed})
    documents = []
    for document in addition['part']['evidence']:
        committed = blob(commit, document)
        actual = Path(document).read_bytes()
        ensure(committed == actual, 'document_actual_commit:' + document)
        documents.append({'path': document, 'sha256': sha(committed), 'currentSameCommitted': True})
    changed_paths = set(subprocess.check_output(['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', commit]).decode().splitlines())
    ensure(all(owner in changed_paths for owner in addition['part']['owners']), 'commit_has_real_owners:' + addition['row'])
    commits.append({'row': addition['row'], 'commit': commit, 'ancestorOfActualBase': True, 'ownerPathsChangedByThisCommit': addition['part']['owners'], 'committedSourceScope': scope_path, 'scopeCommittedSHA256': sha(scope_bytes), 'committedSources': sources, 'documents': documents})
expected['observedCommit'] = BASE
expected['counts'] = {**before['counts'], 'pending': 704, 'partial': 206}
expected['scope'] = '在原203partial／707pending台账上，仅追加771a7bf4、5db015df、40dd1e4d三个实际提交的3part：Noble与Mist两个state格及Wolf Beauty一个lifecycle格；其它907格完整不变，原全部parts／remaining前缀和冻结89行基线保持。新206partial／704pending仍无complete或N/A。本地状态槽／影子与死亡波发布不代表整族类型、请求生命、付款、归档或同输入完整验收，未登记来源继续保留。'
ensure(expected == current, 'entire_matrix_exact_reconstruction')
ensure((json.dumps(expected, ensure_ascii=False, indent=2) + '\n').encode() == MATRIX.read_bytes(), 'entire_matrix_raw_serialization')
statuses = dict.fromkeys(['pending', 'partial', 'complete', 'not-applicable'], 0)
old_parts = old_remaining = 0
selected = {(row['row'], row['column']) for row in additions}
for old_row, new_row in zip(before['rows'], current['rows']):
    ensure({key: value for key, value in old_row.items() if key != 'cells'} == {key: value for key, value in new_row.items() if key != 'cells'}, 'row_metadata')
    for column, old_cell in old_row['cells'].items():
        new_cell = new_row['cells'][column]
        old_parts += len(old_cell['deliveredParts'])
        old_remaining += len(old_cell['remainingRequirements'])
        statuses[new_cell['status']] += 1
        ensure(new_cell['deliveredParts'][:len(old_cell['deliveredParts'])] == old_cell['deliveredParts'], 'original_parts_prefix')
        ensure(new_cell['remainingRequirements'][:len(old_cell['remainingRequirements'])] == old_cell['remainingRequirements'], 'original_remaining_prefix')
        if (old_row['name'], column) not in selected:
            ensure(old_cell == new_cell, 'unaffected_cell')
ensure(statuses == {'pending': 704, 'partial': 206, 'complete': 0, 'not-applicable': 0}, 'recalculated_counts')
baseline_path = before['baseline']['path']
baseline_bytes = Path(baseline_path).read_bytes()
ensure(sha(baseline_bytes) == before['baseline']['sha256'], 'immutable_baseline_digest')
ensure(baseline_bytes == blob(BASE, baseline_path), 'immutable_baseline_actual_base_blob')
creation = subprocess.check_output(['git', 'log', '--diff-filter=A', '--format=%H', '--', baseline_path]).decode().splitlines()
ensure(len(creation) == 1, 'baseline_single_creation')
ensure(baseline_bytes == blob(creation[0], baseline_path), 'immutable_baseline_actual_creation_blob')
result = {'actualMatrixBaseCommit': BASE, 'beforeMatrixPath': PREFIX + 'before.json', 'beforeMatrixSHA256': sha(raw), 'beforeSameActualGit': True, 'afterMatrixSHA256': sha(MATRIX.read_bytes()), 'immutableBaselineSHA256': sha(baseline_bytes), 'immutableBaselineSameActualBaseBlob': True, 'immutableBaselineCreationCommit': creation[0], 'immutableBaselineSameActualCreationBlob': True, 'baselineMetadataCommitMeaning': '27a97cb为冻结测量输入commit，不是生成JSON文件已存在的commit；原metadata不改。', 'beforeCounts': before['counts'], 'afterCounts': current['counts'], 'originalPartCount': old_parts, 'addedPartCount': 3, 'afterPartCount': old_parts + 3, 'originalRemainingCount': old_remaining, 'addedRemainingCount': 3, 'afterRemainingCount': old_remaining + 3, 'allOriginalPartsAndRemainingOrderPrefixesPreserved': True, 'changedCells': changed, 'unchangedCells': 907, 'entireExpectedReconstructionSame': True, 'samePrettyByteSerialization': True, 'allOtherRowColumnPolicyBaselineFieldsSame': True, 'allowedRootMetadataChanges': ['observedCommit', 'counts', 'scope'], 'commitEvidence': commits, 'verification': '仅字节／真实Git来源和精确登记核对，不运行源码、类型、测试或门禁。'}
Path(PREFIX + 'evidence.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'approved': True, 'beforeParts': old_parts, 'beforeRemaining': old_remaining, 'counts': statuses, 'matrixSHA256': result['afterMatrixSHA256'], 'actualBaselineCreation': creation[0], 'currentSourceDifferences': [source['path'] for commit in commits for source in commit['committedSources'] if not source['capturedCurrentSameCommit']]}, ensure_ascii=False))
