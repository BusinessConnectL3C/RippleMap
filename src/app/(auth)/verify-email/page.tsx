import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { SignOutButton } from "@/components/auth/SignOutButton";

interface Props {
  searchParams: Promise<{ sent?: string; verified?: string; invalid?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { verified, invalid } = await searchParams;
  const session = await auth();
  const user = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, emailVerifiedAt: true } })
    : null;

  // Signed in and already verified: nothing to do here.
  if (user?.emailVerifiedAt && !verified) redirect("/onboarding");

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo type="secondary" tone="black" height={30} className="mx-auto" />

        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          {verified ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" aria-hidden="true" />
              <h1 className="text-xl font-bold text-gray-900">Email confirmed</h1>
              <p className="text-sm text-gray-600">Your account is ready. Continue to set up your organization.</p>
              <Button asChild>
                <Link href={user ? "/onboarding" : "/login"}>{user ? "Continue" : "Sign in"}</Link>
              </Button>
            </>
          ) : invalid ? (
            <>
              <AlertCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
              <h1 className="text-xl font-bold text-gray-900">That link has expired or was already used</h1>
              <p className="text-sm text-gray-600">
                {user ? "Send yourself a new one below." : "Sign in and we'll offer to send a new one."}
              </p>
              {user ? <ResendVerificationButton /> : (
                <Button asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <MailCheck className="mx-auto h-10 w-10 text-green-700" aria-hidden="true" />
              <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
              <p className="text-sm text-gray-600">
                We sent a confirmation link to {user ? <strong>{user.email}</strong> : "the email you registered with"}.
                Open it to finish setting up your account. The link expires in 24 hours.
              </p>
              {user ? (
                <ResendVerificationButton />
              ) : (
                <p className="text-sm text-gray-600">
                  Already confirmed?{" "}
                  <Link href="/login" className="text-link hover:underline">
                    Sign in
                  </Link>
                </p>
              )}
            </>
          )}
        </div>

        {user && !user.emailVerifiedAt && (
          <p className="text-xs text-gray-600">
            Wrong email address? <SignOutButton /> and register again.
          </p>
        )}
      </div>
    </div>
  );
}
