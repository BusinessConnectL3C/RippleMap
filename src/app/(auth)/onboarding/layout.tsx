export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
