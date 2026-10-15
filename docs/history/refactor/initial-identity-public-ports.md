# 初始身份库存与选择 API 的公开出口

## 范围与原始来源

实际基线为 `15b680d9d55f4ead009a0fb363c6736523def03a`。六源：既有 initial_identity/ports.ts、新 deal-ports.ts，以及 Thief／Shapeshifter 的四个 deal／setup 包装模块。五个旧源完整 Git 前样与开工源逐字同，新叶当时缺席。无源码删除，无旧公开 Thief／千面人 API 或初始身份 owner 函数退休；只有四条跨族 private import 路径退出。

轻 deal-ports 直接具名公开两族实际使用的 17 个值和 4 个类型，同一实体牌／手牌／备用牌／准备生命周期仍唯一归原 deal。库存读取链只到 deal，不引入重型 setup／Catalog。setup 包装复用已经存在的 ports：增三项选择／scope 查询和 InitialIdentityScope 类型，原窗口类、夜准入与开局发布出口保留。本批没有新 store、选择算法、函数转发、一般 driver 或框架。

## 完整原读取与职责

四个 namespace 保 shared 名称；两个 deal 各有21处成员，两 setup 各有7处成员，合计56处，涉及26个原类型／函数／类／常量声明。全部实际使用的键和表达式原位保留。kind来自已安装库存，不从换牌后角色重分配；异族 undefined／false／ready true、原 open／select 错误、千面人 null slot 拒绝及两族不同选择投影均不变。

三项选择 API 仍分别执行原 authorized scope、请求租约查询和当前候选视图；公开出口不是新的授权。两包装类仍在原 new 表达式晚取 shared.InitialIdentitySetupWindow，构造参数和 construction 对象原引用、execute receiver及参数展开保持。原实体牌互换、参与者／生命、许可、付款、角色／Camp／Victory安装、complete及 finally 全在原 setup所有者，未改政策或错误字符串。

新增 setup→existing ports 的可达声明还包括 initial-deal-publication。已实读该完整叶：只有两项 type import、原 deal 值依赖、interface及 function declaration，没有模块顶层 Date.now.bind、注册、World查询或实例创建；clock／发表在函数调用中晚读。choice原本已由setup加载。新轻facet只有具名export且唯一到deal。库存不因路由变化提前触发窗口模块。

## 并行控制源阶段

原 controls为deal、setup、choice、initial-deal-publication的15b完整Git前态。后继NativeFinal的OriginalParticipant批只在setup将三个helper导入改到core并保原localaliases，当前SHA为 `06949a4306bd99d23add6fa99905f4c15303a771af0b8ac6f803741f52d327eb`。shared-control-route保存完整后态和唯一精确编辑，可从原控制逐字正演；本批不写该源，也不将当前setup声称为wholefixedGit控制。其余三控制原字节保持。

完整族wrapper caller盘点包含bootstrap安装、状态查询、profile准入、接收scope、玩家choices、checkpoint投影与原测试；这些旧入口仍使用原公开族API，无须改它们。前样静态库存扫描七源码根（backend/src、backend/tests、backend/scripts、frontend/src、frontend/tests、packages、tooling）的1918个TS／JS文件，41条相关字面路径；涵盖named／namespace／inline type／star／importEquals／dynamic／require语法，不声明运行拼接路径或历史文档全部覆盖。56成员另经实际TypeChecker沿公开别名递归核到原最终声明，不只比较入口模块名字。

## 首轮有限检查

- 六根类型：`f0e8d3 / session50929 → 3007a6 / exit0`，首次通过。
- 六源中文职责头：`8c70d0 / exit0`，采样679条Git索引文档，原诊断和中文头失败0。
- 原精准三例分别首次通过：跨kind隔离 `d9a9d5` 1/12断言；千面人原库存配置 `39d285` 1/8；原thief/setup fresh入口 `16bf02` 1/2。三不同用例共22断言，不新增镜像单元、不改原标题／fixture／oracle或跑完整组。旧fresh测试自己的子进程命令保原，仅检查选定入口与构造器。
- 主证明 `10dd52 / session51133 → 9526eb / exit0`：五旧完整源六编辑精确正逆，1454 typed节点／1746非注释语法叶／271 NodeArray；10份完整逆向ES/CJS输出同，四actual wrapper仅import module literal映射的8份完整输出同；56成员回到26个原最终声明。保现ports原8项绑定，新公共出口与模块路径的actual完整JS不同，未声称全部新旧raw相同。

所有检查在三组allsource-ready后进行；此后六源未改，未重复绿、全门禁、模型或私有配置。公共模块改变命名出口与模块声明加载路径；没有发现真实新增早捕获／注册，但不承诺任意CJS namespace全键反射、export属性重赋、内建monkeypatch或全冷图恒同。当前类型及绑定读取的传递闭包包含并行已就绪批次，不冒完整固定15b闭包。中文说明与真实权限／生命周期仍须非作者人工审查。
