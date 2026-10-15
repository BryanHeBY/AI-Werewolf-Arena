# 事件、观察、知识与展示

领域事实、player-visible事件、God归档和presentation DTO各有独立owner。领域event并不因带有stage／role字段就自动对某玩家可见；受众按事实发生时的授权保留，当前阵营不能补发历史秘密。

受限观察贡献只投影实际允许且已获知的数据。玩家私有state逐字段白名单，不直接序列化raw私有容器、来源身份、lease或句柄。已经脱离／冻结的某个Observation不意味着完整ActionRequest嵌套对象都有相同schema或freeze保证。

Wolf队友知识、夜聊参与和刀权是三类查询；死亡、变身份、学习、婚礼和既有pack政策分别决定后两者，不抹掉原历史知识。查验的role／camp／combined标签按实际贡献和Camp读取顺序选择；标签不能转化成真实库存或Victory。

共同fact reader只处理声明的数据形状。Node入口的Proxy拒绝、普通descriptor读、浅与递归快照、宽unknown outcome保留规则分别维护；不得用一次类型断言声称所有live输入惰性且零trap。

展示层消费已读事实；格式化字符串、角色名、颜色和提示不成为领域算法。前后端共用game-presentation和game-text，原始名字／人格／发言／模型内容不自动翻译。双语机器schema、稳定event／stage／message key保持；未知历史事件保中性解释，不用坏payload推导存活、投票、胜利或玩家关联。

God复盘可显示全知底牌；这不是Agent可观察知识。玩家文件的局部seq和公开事件seq不混入新协议；控制面ID与内部owner key也不进玩家提示。
