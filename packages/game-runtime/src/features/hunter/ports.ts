/**
 * 提供猎人状态读取与既有初始化命令的公开入口。输入是调用方原角色对象和安装数据；
 * 输出保留原只读状态引用及初始化写契约。每次读取或安装之前，权限检查与失败、关闭窗口
 * 仍由原调用方和状态所有者负责。本入口仅具名导出本角色状态函数，不校验、复制、冻结或存储状态。
 */
export { getHunterState, setHunterState } from "../death-actions/native-resource-ports";
