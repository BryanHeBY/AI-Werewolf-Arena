/**
 * 负责当前编辑页的草稿离开保护；输入组件脏状态，输出导航检查。
 * 状态唯一归 App 的 React context，不持久化密钥、原文或文件，也不阻止显式重新读取。
 */
import { createContext, useContext, useEffect } from "react";
export const DraftContext = createContext<{
  setDirty: (dirty: boolean) => void;
  canLeave: () => boolean;
}>({ setDirty: () => {}, canLeave: () => true });
export function useDraft(dirty: boolean): void {
  const { setDirty } = useContext(DraftContext);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}
export function useCanLeaveDraft() {
  return useContext(DraftContext).canLeave;
}
