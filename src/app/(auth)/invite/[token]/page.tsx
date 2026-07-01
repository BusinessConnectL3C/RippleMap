import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await db.orgInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  const valid = invite && invite.status === "PENDING" && invite.expiresAt > new Date() ? invite : null;

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B4F72]">
            <span className="text-xl font-bold text-white">R</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">RippleMap</h2>
          <p className="text-gray-500">Client Portal</p>
        </div>

        <Card>
          {valid ? (
            <>
              <CardHeader>
                <CardTitle>Join {valid.organization.name}</CardTitle>
                <CardDescription>
                  You&apos;ve been invited as {valid.role === "ADMIN" ? "an Admin" : "a Member"}. Set your name and
                  password to finish creating your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AcceptInviteForm token={token} email={valid.email} />
              </CardContent>
            </>
          ) : (
            <CardHeader>
              <CardTitle>Invite no longer valid</CardTitle>
              <CardDescription>
                This invite link has expired, been revoked, or already been used. Ask your organization admin to
                send a new one.
              </CardDescription>
            </CardHeader>
          )}
        </Card>
      </div>
    </div>
  );
}
