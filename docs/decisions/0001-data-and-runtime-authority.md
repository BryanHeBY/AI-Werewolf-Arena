# ADR 0001：数据与运行授权分离

## 选择

game-contract拥有稳定ID／惰性数据；World及明确authority持真实对象、库存和运行许可。玩家观察、God checkpoint、公共reader与独立verifier不复用同一个“合法数据”入口。

## 理由

相同字段或可序列化对象不能证明原Role／life／source／lease当前。反过来，runtime state的合法getter、扩展字段、alias或cycle也不能因为公共DTO偏窄就被新schema拒绝。纯字段复制与行动准入不是同一职责。

## 后果

- 不把WeakMap许可／回调／原体引用放JSON；不从DTO重构授权。
- 每族own-data／Proxy／descriptor／JSON宽度保实际政策；任何加强须行为差异和独立预期。
- state slot用原存储，不增加镜像；projection不取得写权。
- verifier独立消费档案能证明的字段，不能导生产算法或把缺少life证据当有效body。

相关约束见[身份与资源契约](../contracts/identity-and-resources.md)。
