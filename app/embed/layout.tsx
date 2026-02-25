export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // No padding, no flex centering. Just full width/height container.
    <div className="w-full h-full bg-transparent overflow-hidden">
      {children}
    </div>
  );
}