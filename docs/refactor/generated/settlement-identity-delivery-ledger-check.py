"""核对九个已提交职责子项的原Git来源、完整台账增量与冻结基线；不执行产品或门禁。"""
import collections
import copy
import hashlib
import json
import pathlib
import subprocess

generated = pathlib.Path('docs/refactor/generated')
prefix = 'settlement-identity-delivery-ledger'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
blob = lambda commit, path: subprocess.check_output(['git', 'show', commit + ':' + path])
before = json.loads((generated / (prefix + '-before.json')).read_text())
base = before['baseCommit']
source = before['source'][0]
raw = blob(base, source['path'])
assert sha(raw) == source['sha256'] and raw.decode() == source['text']
old = json.loads(raw)
expected = copy.deepcopy(old)
rows = {(row['kind'], row['name']): row for row in expected['rows']}
additions = json.loads((generated / (prefix + '-additions.json')).read_text())
assert len(additions) == 9
selected = {(item['rowKind'], item['row'], item['column']) for item in additions}
assert len(selected) == 8
commit_evidence = []
for item in additions:
    part = item['delivered']
    commit = part['commit']
    subprocess.run(['git', 'merge-base', '--is-ancestor', commit, base], check=True)
    scope_raw = blob(commit, item['sourceScope']['path'])
    assert sha(scope_raw) == item['sourceScope']['sha256']
    scope = json.loads(scope_raw)
    actual_sources = {row['path']: row['sha256'] for row in scope['source']}
    changed = set(subprocess.check_output(['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', commit]).decode().splitlines())
    assert part['owners'] == [row['path'] for row in item['ownerSources']]
    captures = []
    for owner in item['ownerSources']:
        original = blob(commit, owner['path'])
        assert sha(original) == owner['sha256'] == actual_sources[owner['path']]
        assert owner['path'] in changed
        observed = blob(base, owner['path'])
        current = pathlib.Path(owner['path'])
        captures.append({**owner, 'observedGitSHA256': sha(observed),
                         'observedGitSameDelivery': observed == original,
                         'currentWorktreeSHA256': sha(current.read_bytes()) if current.exists() else None})
    document = item['documentation']
    assert sha(blob(commit, document['path'])) == document['sha256']
    assert blob(base, document['path']) == blob(commit, document['path'])
    assert part['evidence'] == [document['path']]
    cell = rows[(item['rowKind'], item['row'])]['cells'][item['column']]
    assert cell['status'] in ('pending', 'partial')
    cell['status'] = 'partial'
    cell['deliveredParts'].append(part)
    cell['remainingRequirements'].append(item['remaining'])
    commit_evidence.append({'rowKind': item['rowKind'], 'row': item['row'], 'column': item['column'],
                           'commit': commit, 'ancestorOfObservedGit': True, 'scope': item['sourceScope'],
                           'owners': captures, 'document': document})

current_raw = pathlib.Path(source['path']).read_bytes()
current = json.loads(current_raw)
expected['observedCommit'] = base
expected['scope'] = current['scope']
counts = collections.Counter(cell['status'] for row in expected['rows'] for cell in row['cells'].values())
for key in ('pending', 'partial', 'complete', 'not-applicable'):
    expected['counts'][key] = counts[key]
assert current == expected
assert current_raw == (json.dumps(expected, ensure_ascii=False, indent=2) + '\n').encode()
assert counts == {'pending': 682, 'partial': 228}
old_parts = sum(len(cell['deliveredParts']) for row in old['rows'] for cell in row['cells'].values())
new_parts = sum(len(cell['deliveredParts']) for row in current['rows'] for cell in row['cells'].values())
assert old_parts == 322 and new_parts == 331
unchanged = 0
for old_row, new_row in zip(old['rows'], current['rows']):
    assert {k: v for k, v in old_row.items() if k != 'cells'} == {k: v for k, v in new_row.items() if k != 'cells'}
    for column, previous in old_row['cells'].items():
        after = new_row['cells'][column]
        assert after['deliveredParts'][:len(previous['deliveredParts'])] == previous['deliveredParts']
        assert after['remainingRequirements'][:len(previous['remainingRequirements'])] == previous['remainingRequirements']
        if (old_row['kind'], old_row['name'], column) not in selected:
            assert previous == after
            unchanged += 1
assert unchanged == 902
baseline = current['baseline']
baseline_raw = pathlib.Path(baseline['path']).read_bytes()
assert sha(baseline_raw) == baseline['sha256']
assert baseline_raw == blob(base, baseline['path'])
creation = subprocess.check_output(['git', 'log', '--diff-filter=A', '--format=%H', '--', baseline['path']]).decode().splitlines()
assert len(creation) == 1 and baseline_raw == blob(creation[0], baseline['path'])
report = {'observedCommit': base, 'beforeSHA256': source['sha256'], 'matrixSHA256': sha(current_raw),
          'beforeParts': old_parts, 'afterParts': new_parts, 'addedParts': 9, 'changedCells': 8,
          'unchangedCells': unchanged, 'allOriginalPartsAndRemainingPrefixesPreserved': True,
          'entireReconstructionAndRawSerializationSame': True, 'counts': current['counts'],
          'immutableBaselineSHA256': sha(baseline_raw), 'immutableBaselineCreationCommit': creation[0],
          'commitEvidence': commit_evidence,
          'limits': ['只登记固定13366731公开Git内九个真实已交付职责子项；当前未提交枪／首夜槽不计入观察。',
                     '更早交付仍须逐项补登记，零complete/N/A保持；partial、少量出口退休和结构ID清除不完成整角色。',
                     '工作树SHA只是本次只读采样，可能含并行WIP；职责来源以具体交付Git与固定observed Git为准。',
                     '不执行产品、类型、行为、架构门禁或模型；仅证据来源与完整台账增量核对。']}
(generated / (prefix + '-report.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: report[key] for key in ['observedCommit', 'addedParts', 'changedCells', 'unchangedCells', 'counts', 'matrixSHA256']}, ensure_ascii=False))
