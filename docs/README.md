# Docs Index

## Main Entrypoints

- Guides: [`docs/guides/readme.md`](./guides/readme.md)
- References: [`docs/references/readme.md`](./references/readme.md)
- Specs: [`docs/specs/readme.md`](./specs/readme.md)
- Module Docs: [`docs/modules/`](./modules)
- Project-level Docs: [`docs/project/`](./project)

## Archive Conventions

- 各子目录内统一使用 `archive/` 存放“阶段性、已完成 TODO、历史复盘”文档。
- 当前活跃文档保留在子目录根层，避免索引被历史材料淹没。
- 归档入口：
  - guides: [`docs/guides/archive/`](./guides/archive)
  - specs: [`docs/specs/archive/`](./specs/archive)
  - project: [`docs/project/archive/`](./project/archive)

## Migrated Documents

- 原 `backend/README.md` -> [`docs/modules/backend_overview.md`](./modules/backend_overview.md)
- 原 `frontend/README.md` -> [`docs/modules/frontend_overview.md`](./modules/frontend_overview.md)
- 原 `configs/README.md` -> [`docs/modules/config_runtime_boards.md`](./modules/config_runtime_boards.md)
- 原 `configs/system-prompts/README.md` -> [`docs/modules/config_system_prompts_deprecated.md`](./modules/config_system_prompts_deprecated.md)
- 原 `backend/docs/llm_user_prompt_three_line_spec.md` -> [`docs/specs/llm_user_prompt_three_line_spec.md`](./specs/llm_user_prompt_three_line_spec.md)
- 原根目录 `README.md` -> [`docs/project/legacy_root_readme.md`](./project/legacy_root_readme.md)

## Notes

- 仓库根目录仅保留结构总览与 docs 入口。
- 后续新增文档统一放在 `docs/` 下，不再在 `backend/`、`frontend/`、`configs.example/` 分散维护 README 文档。
