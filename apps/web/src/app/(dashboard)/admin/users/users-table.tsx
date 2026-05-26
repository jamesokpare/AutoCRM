"use client";

import { Role } from "@crm-tool/db/enums";
import { Badge } from "@crm-tool/ui/components/badge";
import { Button } from "@crm-tool/ui/components/button";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crm-tool/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm-tool/ui/components/table";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveUser, deactivateUser, deleteUser, setRoles } from "./actions";
import type { AdminUserRow } from "./actions-types";

const ROLE_OPTIONS = Object.values(Role) as Role[];

function RoleEditor({
  user,
  onSaved,
}: {
  user: AdminUserRow;
  onSaved: (roles: Role[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Role[]>(user.roles);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="xs">Roles</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roles for {user.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {ROLE_OPTIONS.map((role) => {
            const checked = selected.includes(role);
            return (
              <label key={role} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(isChecked) =>
                    setSelected((prev) =>
                      isChecked ? [...prev, role] : prev.filter((r) => r !== role),
                    )
                  }
                />
                {role}
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await setRoles(user.id, selected);
                if (!res.ok) {
                  toast.error(res.error ?? "Failed");
                  return;
                }
                toast.success("Roles updated");
                onSaved(selected);
                setOpen(false);
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersTable({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [pending, startTransition] = useTransition();

  const patch = (id: string, data: Partial<AdminUserRow>) =>
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {user.roles.length ? (
                  user.roles.map((r) => (
                    <Badge key={r} variant="secondary">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {user.banned ? (
                  <Badge variant="destructive">Deactivated</Badge>
                ) : user.isApproved ? (
                  <Badge variant="success">Approved</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap justify-end gap-1.5">
                {!user.isApproved ? (
                  <Button
                    size="xs"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await approveUser(user.id);
                        if (!res.ok) {
                          toast.error(res.error ?? "Failed");
                          return;
                        }
                        toast.success("Approved");
                        patch(user.id, { isApproved: true });
                      })
                    }
                  >
                    Approve
                  </Button>
                ) : null}

                <RoleEditor user={user} onSaved={(roles) => patch(user.id, { roles })} />

                {user.id !== currentUserId ? (
                  <>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deactivateUser(user.id, !user.banned);
                          if (!res.ok) {
                            toast.error(res.error ?? "Failed");
                            return;
                          }
                          toast.success(user.banned ? "Reactivated" : "Deactivated");
                          patch(user.id, { banned: !user.banned });
                        })
                      }
                    >
                      {user.banned ? "Reactivate" : "Deactivate"}
                    </Button>
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deleteUser(user.id);
                          if (!res.ok) {
                            toast.error(res.error ?? "Failed");
                            return;
                          }
                          toast.success("Deleted");
                          setUsers((prev) => prev.filter((u) => u.id !== user.id));
                        })
                      }
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
