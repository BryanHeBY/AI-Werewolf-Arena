# 共用参与者所有者冻结交付

{
  "scope": {
    "path": "docs/refactor/generated/original-participant-owner-scope-final.json",
    "sha256": "ce74ea0cbc01fea273143f0e2c05a0bac0f7a9a42982997f608832deea7affb0"
  },
  "document": {
    "path": "docs/refactor/original-participant-owner.md",
    "sha256": "27231e73aa7871b80aff410e366cabc6e9a009f00356e7d22a68e412243d4b26"
  },
  "evidence": {
    "path": "docs/refactor/generated/original-participant-owner-evidence.json",
    "sha256": "f434ac2a38ff7b3d044f086f070d2bc3cc4614bf960fc59808dc0e3b8d552049"
  },
  "source": [
    {
      "path": "backend/src/core/domain/original-participant.ts",
      "sha256": "66f03294e2a84d922973e1a0eb932323d0b7632bf19cefc64d09a76433bf8467"
    },
    {
      "path": "backend/src/game/mechanisms/roles/debater/authority.ts",
      "sha256": "e83bbc1d73641acb2561b9eb44564975cbc848d12100385bd210a8ab5dcf81ab"
    },
    {
      "path": "backend/src/game/mechanisms/roles/debater/window.ts",
      "sha256": "bd675e17531805ee2f250f93ae81d474da8f1b7efe9a6e51dc32b6951f6874dc"
    },
    {
      "path": "backend/src/game/mechanisms/roles/debater/profile.ts",
      "sha256": "25a8cad2591d98cd1b6a9923621448a4a44b15f65e6191aa056c1ca8dc98cd79"
    },
    {
      "path": "backend/src/game/mechanisms/common/validation_rules.ts",
      "sha256": "c0d79068da51362937b4a6bd5eadbad1942d607e04f8399507684b557d450836"
    },
    {
      "path": "backend/src/game/mechanisms/roles/initial_identity/setup.ts",
      "sha256": "06949a4306bd99d23add6fa99905f4c15303a771af0b8ac6f803741f52d327eb"
    },
    {
      "path": "backend/src/game/mechanisms/roles/wild_child/lifecycle.ts",
      "sha256": "86ce818fe51ce5b5436f757b1c6bf72f7edfa5ec4881200ad2728ae734b48687"
    },
    {
      "path": "backend/src/game/mechanisms/events/wall_notes/authority.ts",
      "sha256": "4a1c0e71ecb0b3509d2cd4355dc6e4e113d6bb1df952a2cf46c09c5cd8d14b3b"
    },
    {
      "path": "backend/tests/unit/domain/original-participant.test.ts",
      "sha256": "ec76b0e8b1ada90d002c05c2c8a9c221fd2f67baa2fe3c3aa0a7308a67a3bb62"
    }
  ],
  "artifacts": 18
}

Root 负责非作者交叉审查与功能提交；作者未 stage/progress，已绿 checks 不复跑。
