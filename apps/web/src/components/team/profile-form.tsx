"use client";

import { Role } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/actions/profile";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: Role.MANAGER, label: "Manager" },
  { value: Role.SERVICE_ADVISOR, label: "Service Advisor" },
  { value: Role.TECHNICIAN, label: "Technician" },
  { value: Role.PARTS_STAFF, label: "Parts Staff" },
  { value: Role.ADMIN, label: "Admin" },
];

export interface ProfileFormValues {
  name: string;
  roles: Role[];
  jobTitle: string | null;
  photo: string | null;
  kpis: string | null;
  bottlenecks: string | null;
}

/** EMP-01/02: edit the authenticated user's own profile. */
export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial.name);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle ?? "");
  const [roles, setRoles] = useState<Role[]>(initial.roles);
  const [photo, setPhoto] = useState(initial.photo ?? "");
  const [kpis, setKpis] = useState(initial.kpis ?? "");
  const [bottlenecks, setBottlenecks] = useState(initial.bottlenecks ?? "");

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateProfile({ name, roles, jobTitle, photo, kpis, bottlenecks });
          if (!res.ok) {
            toast.error(res.error ?? "Could not save profile");
            return;
          }
          toast.success("Profile saved");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Name</Label>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-jobtitle">Your role</Label>
        <Input
          id="profile-jobtitle"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Lead mechanic, Front desk, Service writer"
        />
        <p className="text-xs text-muted-foreground">
          What you do in your own words — shown to teammates.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Access level</Label>
        <p className="text-xs text-muted-foreground">
          Controls what you can edit in the system.
        </p>
        <div className="flex flex-col gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const checked = roles.includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(isChecked) =>
                    setRoles((prev) =>
                      isChecked ? [...prev, opt.value] : prev.filter((r) => r !== opt.value),
                    )
                  }
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-photo">Photo URL (optional)</Label>
        <Input
          id="profile-photo"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-kpis">Your KPIs</Label>
        <Textarea
          id="profile-kpis"
          value={kpis}
          onChange={(e) => setKpis(e.target.value)}
          placeholder="What metrics define success in your role?"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-bottlenecks">Current bottlenecks</Label>
        <Textarea
          id="profile-bottlenecks"
          value={bottlenecks}
          onChange={(e) => setBottlenecks(e.target.value)}
          placeholder="What slows you down day to day?"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
