# C07-B MessageKey/MessageRef 中立owner 实现交接

作者独占且仅写：

- packages/game-contract/src/message-ids.ts
- packages/game-contract/src/message-refs.ts
- packages/game-contract/tests/message-contract.test.ts
- packages/game-text/src/index.ts（相关type import/re-export/interface与职责头）
- packages/game-text/src/zh-CN.ts（相关type import/exact satisfies/兼容type转发/职责头）
- packages/game-text/src/en.ts（相关type import/职责头）

Root持有的 contract/index、package deps/lock、root runner、消费者接线未由我修改。

## 契约

MESSAGE_IDS为hand-maintained语言无关canonical literal registry，Object.freeze tuple；MessageKey=(typeof MESSAGE_IDS)[number]、isMessageKey只判断primitive string membership。值序列冻结自2d36e4d，1513项，序列SHA cd750ba72a9b5902562d650125797b2417126bdb82b2aaa199822b05cd22ec78。

message-refs原interface的key和optional readonly Record<string,string|number>一字形状保留。不收紧成按key参数泛型；NaN/缺/额外参数仍由text()/reproduction superRefine拒绝。没有把dictionary/renderer/node依赖引入contract，没有迁资源/授权句柄。

zhCN以as const satisfies exact Record消费中立MessageKey，英文消费同一类型。旧text/zh的MessageKey及text MessageRef具名compat type转发保留；词典只拥有translations，不再定义机器key union。

一次性迁移输入提取脚本 /tmp/awa-c07b-freeze-message-keys.ts 只读取固定Git AST；不是长期generator或运行入口。source头记录来源与此后手维护owner。独立test expected digest是固定Git输入证据，不从当前MESSAGE_IDS生成新golden。

## 字节与函数保真

/tmp/awa-c07b-dictionary-byte-proof.ts / .json：

- 固定Git2d36e4d与candidate完整dictionary object literal bytes相同。
- zh 1513：literal SHA7ca74e715a2aaa3e874465f0ea90b30f00bfc4412c0dbd49201f4705633e4e77；key顺序SHAcd750...。
- en 1513：literal SHA132290de4fe761b9dedbdda86db22f08b31ca8df86fd9fec3eaacca675966663；key顺序SHA7765d6f82eddd41d28adf1d62197a5d6830deb573087ac4aadf2389aa21737db。
- text/index原42函数全文均未改；formatter/refine、label/fact/preset算法没有在本slice改动。

## 有限验证

新message4 tests + 原text package4 tests：8 pass / 0 fail / 3200 expect，/tmp/awa-c07b-message-owner-tests-second.log。大量assert来自原完整dictionary key/placeholder小包测试，不是full engine/frontsuite。

contract与text各source/tests四个TypeScript项目exit0；新tests包含closedkey/unknownref/booleanparam/readonlyparam @ts-expect-error负例。六文件Prettier check0。

首轮text尚未physical link的load module failure与type errors保留first.log，root offline links后通过轮独立记录。没用any/string绕过，也没混合 pass数字。

待root/另一agent做独立review；作者不自称review闭合。Root处理具体bridge/C44账本、production pure consumer imports、samecommit public exports/显式依赖/source fingerprint与必要下游types；不重复全量门禁。

独立Git2d36审查确认两个ObjectLiteral、1513keys/value/order、MessageRef shape和42个text函数逐字节相同。core/actions、engine action factory/turn constraints和audit纯类型consumer直接使用中立MessageRef，formatter/refine仍原语义，现有request_message_refs4/0。无运行句柄进入纯包。词典不再是机器MessageKey authority；未来新增ID在contract一处维护并由译文exact coverage校验。
