#!/usr/bin/env python3
"""核对冻结历史与显式 Git 基线的成员、原字节和执行位。

输入为仓库、实际捕获提交和原路径索引；直接重读该 Git 的历史全集，
不允许仅靠修改索引来接纳历史改文。只读归档，不写回索引或历史文件。
本说明也是命令行的中文帮助；不检查 Markdown 链接、当前源码或后继
acceptance 包，不能代替类型、测试、结构门禁与最终同源验收。
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys

ROOTS = ('docs/expansion/', 'docs/refactor/')
TARGETS = ('docs/history/expansion/', 'docs/history/refactor/')
CURRENT_INDEX_PAGES = {'docs/history/expansion/README.md', 'docs/history/refactor/README.md'}

def fail(message):
    raise RuntimeError(message)

def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])

def safe(value):
    path = PurePosixPath(value)
    if path.is_absolute() or '..' in path.parts or '\\' in value or str(path) != value:
        fail('unsafe path')
    return value

def bytes_mode(repo, relative):
    target = repo / safe(relative)
    parent = target.parent
    while parent != repo:
        if parent.is_symlink():
            fail('symlink directory: ' + str(parent))
        parent = parent.parent
    if target.is_symlink():
        return os.readlink(target).encode(), '120000'
    if not target.is_file():
        fail('missing ordinary archive file: ' + relative)
    # Git 普通文件模式只区分 owner executable 位，不承诺保留全部 POSIX 权限。
    return target.read_bytes(), '100755' if target.stat().st_mode & 0o100 else '100644'

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo', required=True)
    p.add_argument('--base', required=True)
    p.add_argument('--manifest', default='docs/history/origin-paths.json')
    a = p.parse_args()
    if a.base in ('HEAD', '@'):
        fail('pass the explicit captured commit')
    repo = Path(a.repo).resolve()
    base = git(repo, 'rev-parse', '--verify', a.base + '^{commit}').decode().strip()
    manifest_bytes, manifest_mode = bytes_mode(repo, a.manifest)
    if manifest_mode == '120000':
        fail('manifest must not be a symlink')
    manifest = json.loads(manifest_bytes)
    if manifest['schema'] != 'awa-history-origin-index-v1' or manifest['originCommit'] != base:
        fail('manifest/base identity mismatch')
    # 原索引只是位置记录；原 Git 的完整成员、blob、mode 和字节另行逐项核对。
    rows = manifest['files']
    expected = {}
    for entry in git(repo, 'ls-tree', '-rz', '--full-tree', base, '--', 'docs/expansion', 'docs/refactor').split(b'\0'):
        if not entry:
            continue
        info, name = entry.split(b'\t', 1)
        mode, kind, oid = info.decode().split()
        if kind != 'blob' or mode not in ('100644', '100755', '120000'):
            fail('unsupported Git object')
        expected[name.decode()] = (mode, oid)
    if len(rows) != len(expected) or {r['originPath'] for r in rows} != set(expected):
        fail('manifest is not the entire explicit Git history input set')
    # 流式读取原 blob；归档正文按原字节比较，不解析或重排未知扩展名内容。
    batch = subprocess.Popen(['git', '-C', str(repo), 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    try:
        for row in rows:
            origin = safe(row['originPath'])
            current = safe(row['currentPath'])
            if not origin.startswith(ROOTS) or current != origin.replace('docs/', 'docs/history/', 1):
                fail('non-exact origin/target mapping')
            if row['originCommit'] != base or expected[origin] != (row['mode'], row['originalGitBlob']):
                fail('manifest changes original Git mode/blob')
            batch.stdin.write((row['originalGitBlob'] + '\n').encode())
            batch.stdin.flush()
            header = batch.stdout.readline().decode().strip().split()
            if len(header) != 3 or header[0] != row['originalGitBlob'] or header[1] != 'blob':
                fail('Git object unavailable')
            size = int(header[2]); remaining = size; h = hashlib.sha256()
            while remaining:
                data = batch.stdout.read(min(remaining, 1024 * 1024))
                if not data:
                    fail('truncated Git object')
                h.update(data); remaining -= len(data)
            if batch.stdout.read(1) != b'\n' or size != row['bytes'] or h.hexdigest() != row['sha256']:
                fail('manifest changes original bytes/SHA: ' + origin)
            actual, mode = bytes_mode(repo, current)
            if mode != row['mode'] or len(actual) != size or hashlib.sha256(actual).hexdigest() != row['sha256']:
                fail('archive bytes/mode changed: ' + current)
            if (repo / origin).exists() or (repo / origin).is_symlink():
                fail('old historical duplicate remains: ' + origin)
    finally:
        batch.stdin.close(); batch.stdout.close()
        if batch.wait() != 0:
            fail('Git object reader failed')
    # 原路径逐项缺席还不够：旧根后来新增的文件也不得逃过归档全集守卫。
    # 先拒绝根本身的链接，再枚举真实子目录；空目录不属于 Git 文件集合。
    for prefix in ROOTS:
        old_root = repo / prefix
        if old_root.is_symlink():
            fail('old history root symlink: ' + prefix)
        if not old_root.exists():
            continue
        if not old_root.is_dir():
            fail('old history root is not a retired directory: ' + prefix)
        for directory, dirs, files in os.walk(old_root, followlinks=False):
            for name in dirs:
                if (Path(directory) / name).is_symlink():
                    fail('old history directory symlink')
            if files:
                fail('old history roots contain uncaptured files: ' + str(Path(directory) / files[0]))
    # 两个冻结历史根仅容许原全集和各自当前入口页；后继证据不得追加到这些根。
    actual_paths = set()
    for root in TARGETS:
        for directory, dirs, files in os.walk(repo / root, followlinks=False):
            for name in dirs:
                if (Path(directory) / name).is_symlink():
                    fail('archive directory symlink')
            actual_paths.update(str((Path(directory) / name).relative_to(repo)) for name in files)
    if actual_paths != {r['currentPath'] for r in rows} | CURRENT_INDEX_PAGES:
        fail('unknown/missing file in format-exempt archive roots')
    # 两个 README 属当前导航，不在原归档字节集合内，仍由正常文档格式检查负责。
    for page in CURRENT_INDEX_PAGES:
        if bytes_mode(repo, page)[1] == '120000':
            fail('current history landing page must not be a symlink')
    print(json.dumps({'baseCommit': base, 'historyFiles': len(rows), 'originalGitAndArchiveBytesModes': 'match',
                      'limits': 'No claim about current source, links, runtime behavior or final acceptance.'}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('archive integrity guard failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
