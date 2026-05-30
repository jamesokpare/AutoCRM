"use client";

import { Button } from "@crm-tool/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@crm-tool/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteOwnAccount } from "@/lib/actions/profile";
import { authClient } from "@/lib/auth-client";

/**
 * Self-service account deletion. Requires the user to retype their email to
 * confirm — same guardrail as a typical "Danger zone" delete flow. After the
 * server action removes the user row, we call `authClient.signOut` to clear
 * the now-invalid cookie locally and route back to the public landing page.
 */
export function DeleteAccountCard({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const matches = confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          Permanently remove your account and all data tied to it — reviews you wrote,
          tasks you created, attendance, notifications. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setConfirmEmail("");
          }}
        >
          <DialogTrigger render={<Button variant="destructive" size="sm">Delete my account</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This is permanent. Type <span className="font-medium text-foreground">{email}</span> below to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm-email">Your email</Label>
              <Input
                id="delete-confirm-email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={email}
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending || !matches}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteOwnAccount({ confirmEmail });
                    if (!res.ok) {
                      toast.error(res.error ?? "Could not delete account");
                      return;
                    }
                    await authClient.signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          toast.success("Account deleted");
                          router.push("/");
                        },
                      },
                    });
                  })
                }
              >
                {pending ? "Deleting…" : "Delete account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
