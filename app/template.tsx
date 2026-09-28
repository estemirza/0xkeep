// Re-mounts on every route change, so each page fades in smoothly.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter h-full">{children}</div>;
}
