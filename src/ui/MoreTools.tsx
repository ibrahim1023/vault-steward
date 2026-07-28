import { Children, type JSX, type ReactNode } from "react";

export function MoreTools({ children }: { children: ReactNode }): JSX.Element | null {
  if (Children.toArray(children).length === 0) return null;

  return (
    <details className="more-tools">
      <summary>More</summary>
      <div className="more-tools-content">{children}</div>
    </details>
  );
}
