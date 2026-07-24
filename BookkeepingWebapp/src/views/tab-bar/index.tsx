/**
 * Only the coordinator component and its data contract are exported. The
 * internal helpers - `Tabs`, `Tab`, `useActiveTab`, `useDragReorder` - stay
 * private to this directory so their composition can change freely.
 */
export { TabBar, default } from "./TabBar";
export type { TabBarProps, TabDescriptor, TabVisitor } from "./types";
