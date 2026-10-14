"""核对已提交职责登记；只读真实 Git、当前台账和已声明增量。"""
import collections
import copy
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path('/home/hby/dev/AI-Werewolf-Arena')
prefix = 'runtime-verification-delivery-ledger'
generated = root / 'docs/refactor/generated'

def read(name):
    return json.loads((generated / (prefix + '-' + name + '.json')).read_text())

def git(commit, path):
    return subprocess.check_output(['git', 'show', commit + ':' + path], cwd=root)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

before = read('before')
raw = git(before['baseCommit'], before['path'])
assert sha(raw) == before['sha256']
old = json.loads(raw)
expected = copy.deepcopy(old)
additions = read('additions')
rows = {row['name']: row for row in expected['rows']}
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
for item in additions:
    part = item['delivered']
    subprocess.run(['git', 'merge-base', '--is-ancestor', part['commit'], head], cwd=root, check=True)
    declared = item['sourceScope']
    scope_raw = git(part['commit'], declared['path'])
    assert sha(scope_raw) == declared['sha256']
    scope = json.loads(scope_raw)
    sources = {s['path']: s['sha256'] for s in scope.get('source', scope.get('sources', scope.get('files', [])))}
    assert part['owners'] == [s['path'] for s in item['ownerSources']]
    for source in item['ownerSources']:
        assert sha(git(part['commit'], source['path'])) == source['sha256'] == sources[source['path']]
    document = item['documentation']
    assert sha(git(part['commit'], document['path'])) == document['sha256']
    assert part['evidence'] == [document['path']]
    cell = rows[item['row']]['cells'][item['column']]
    assert cell['status'] in ('pending', 'partial')
    cell['status'] = 'partial'
    cell['deliveredParts'].append(part)
    cell['remainingRequirements'].append(item['remaining'])

current_raw = (root / before['path']).read_bytes()
current = json.loads(current_raw)
for key in ('observedCommit', 'scope'):
    expected[key] = current[key]
expected['counts'] = copy.deepcopy(old['counts'])
counts = collections.Counter(c['status'] for row in expected['rows'] for c in row['cells'].values())
for key in ('pending', 'partial', 'complete', 'not-applicable'):
    expected['counts'][key] = counts[key]
assert current == expected
assert len(additions) == 21 and len({(a['row'], a['column']) for a in additions}) == 21
assert counts['partial'] == 222 and counts['pending'] == 688
assert not counts['complete'] and not counts['not-applicable']
assert sha((root / current['baseline']['path']).read_bytes()) == current['baseline']['sha256']
print(json.dumps({'approved': True, 'partsAdded': 21, 'unchangedCells': 889, 'counts': current['counts'], 'matrixSHA256': sha(current_raw)}, ensure_ascii=False))
