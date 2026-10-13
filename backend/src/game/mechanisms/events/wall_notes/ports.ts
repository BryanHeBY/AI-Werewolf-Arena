/**
 * 提供墙上留言原请求作用域的公开查询入口；输入为原 World 与同一请求，输出保留原绑定引用。
 * 实际 Gateway 在原 scope 参数时点调用此同函数，不提前读取状态或复制许可。
 * 具体失效与写入由留言 authority 拥有；本入口不渲染提示、不写库存或授予新租约。
 */
export { wallRequestScope } from "./authority";
