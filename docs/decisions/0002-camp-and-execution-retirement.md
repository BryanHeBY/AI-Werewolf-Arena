# ADR 0002：实际Camp与失败执行退休

## 选择

Role不持camp镜像；实际Camp组件是现场来源。初始化显式initialCamp／currentCamp，metadata只给默认初值。身份安装失败用Role对象的永久执行墓碑关闭未付动作，不保存失败前Camp、不回滚世界、不建Role→World映射。

## 理由

旧重复字段在组件安装抛错后可能与真实Camp分叉；单纯删除镜像又可能让旧“失配”条件恢复。必须明确两个独立政策：实际当前读什么，以及失败对象还能否发起新行动。

## 后果

正常Camp变化不mark；value-only与严格ref族仍不同。字段恢复／同对象跨World不恢复已退休执行，但pure state／target／knowledge／paid current不因此统一拒绝。转换核心之后facts错误保已经提交资格；核心失败保原Error与Role→Camp→Victory的实际前缀。

来源：[单一输入政策](../history/refactor/camp-canonical-input-policy.md)、[失败执行政策](../history/refactor/role-execution-failure-policy.md)、[野孩子失败边界](../history/refactor/wild-child-transform-failure-owner.md)。记录是政策依据，不是所有55专属动作最终验收结论。
