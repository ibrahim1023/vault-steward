import type { JSX, ReactNode } from "react";

export function MoreTools({ children }: { children: ReactNode }): JSX.Element {
  return (
    <details className="more-tools">
      <summary>More</summary>
      <div className="more-tools-content">{children}</div>
    </details>
  );
}
