/**
 * 负责哥特身份章与出局斜章的静态素材地址。输入为固定原创资源，输出由两种宿主打包的 URL。
 * 资源不含姓名、角色文字或生命事实；调用方依当前许可身份和已提交状态选择叠字。
 */
export const identityMedallion = new URL(
  "../../video/assets/gothic/identity-medallion-v1.png",
  import.meta.url,
).href;
export const eliminatedPlate = new URL(
  "../../video/assets/gothic/eliminated-plate-v1.png",
  import.meta.url,
).href;
