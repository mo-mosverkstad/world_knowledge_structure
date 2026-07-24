import React, {
  type ReactElement,
  type ReactNode,
  Children,
  isValidElement,
  useEffect,
  useState,
} from "react";
import "./style.css";

interface TabProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function TabBar({ children }: { children: ReactNode }) {
  const tabs = Children.toArray(children).filter(
    (child) => {
      if (!isValidElement(child)) return false;
      return child.type === Tab}
  ) as ReactElement<TabProps>[];

  return (
    <>
      <div className="tabs">
        {tabs}
      </div>
    </>
  );
}

export function Tab({children, onClick = () => {},}: {children: ReactNode;  onClick?: () => void;}) {
    return (
        <div
          className="tab"
          onClick={() => onClick()}
        >
          Tab: {children}
        </div>
    );
}
