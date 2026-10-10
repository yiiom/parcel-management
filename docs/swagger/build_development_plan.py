"""產生 API 對照；開發進度由 docs/development-plan.md 人工維護。"""
import json
from pathlib import Path

base = Path(__file__).resolve().parent
spec = json.loads((base / 'openapi.json').read_text(encoding='utf-8'))
phases = json.loads((base / 'development-phases.json').read_text(encoding='utf-8'))
features = json.loads((base / 'operation-features.json').read_text(encoding='utf-8'))
operations = {op['operationId']: (method.upper(), path, op)
              for path, methods in spec['paths'].items() for method, op in methods.items()}
for mapping in (phases, features):
    flat = [key for group in mapping.values() for key in group]
    assert len(flat) == len(set(flat)) and set(flat) == set(operations), 'Missing or duplicated operation'
feature_by_id = {ident: feature for feature, group in features.items() for ident in group}
lines = ['# API 功能與階段對照', '',
         '本檔自動產生，只記錄規格對照，不記錄完成狀態。實際進度見 [開發順序與驗收](../development-plan.md)。', '',
         '第一階段為規則與文件，沒有業務 API 實作。第二階段為基本功能，第三階段為主要功能。', '',
         'Q-01～Q-10已確認；決議及技術待辦見 [確認清單](../open-questions.md)。', '']
for phase, group in phases.items():
    lines += [f'## 第 {phase} 階段 共 {len(group)} 個操作', '']
    if not group:
        lines += ['確認規則與文件。', '']
        continue
    lines += ['| 功能 | 方法與路徑 | 操作 | operationId |', '|---|---|---|---|']
    for ident in group:
        method, path, op = operations[ident]
        assert op['x-development-phase'] == int(phase)
        lines.append(f'| {feature_by_id[ident]} | `{method} {path}` | {op["summary"]} | `{ident}` |')
    lines.append('')
(base / 'api-checklist.md').write_text('\n'.join(lines), encoding='utf-8')
print(f'Validated {len(operations)} operations; phase counts: ' + ', '.join(f'{p}={len(g)}' for p,g in phases.items()))
