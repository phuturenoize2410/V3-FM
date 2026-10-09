import type { TabId } from '../types';
import { NAV_GROUPS } from '../components/Navigation';

/** One typed module callback, backed by the existing sidebar directory.
 * Runtime callers cannot blank the workspace with a legacy or unknown ID.
 * Module state and finance inputs remain owned by their existing components.
 */
export type NavigateToTab = (tab: TabId) => void;
export function isTabId(value: unknown): value is TabId {
  return typeof value === 'string' && NAV_GROUPS.some(group => group.tabs.some(tab => tab.id === value));
}
