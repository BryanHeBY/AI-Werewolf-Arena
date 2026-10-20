/**
 * 负责当前编辑页的草稿离开保护；输入组件脏状态，输出导航检查。
 * 状态唯一归 App 的 React context，不持久化密钥、原文或文件，也不阻止显式重新读取。
 */
import { createContext, useContext, useEffect, useId } from "react";
export const DraftContext = createContext<{
  setDirty: (owner: string, dirty: boolean) => void;
  canLeave: () => boolean;
}>({ setDirty: () => {}, canLeave: () => true });
export function useDraft(dirty: boolean): void {
  const { setDirty } = useContext(DraftContext);
  const owner = useId();
  useEffect(() => {
    setDirty(owner, dirty);
    return () => setDirty(owner, false);
  }, [dirty, setDirty, owner]);
}
export function useCanLeaveDraft() {
  return useContext(DraftContext).canLeave;
}
