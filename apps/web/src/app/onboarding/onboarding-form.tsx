"use client";

import { Role } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
import { Input } from "@crm-tool/ui/components/input";
import { Label } from "@crm-tool/ui/components/label";
import { Textarea } from "@crm-tool/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { completeProfile } from "./actions";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: Role.MANAGER, label: "Manager" },
  { value: Role.SERVICE_ADVISOR, label: "Service Advisor" },
  { value: Role.TECHNICIAN, label: "Technician" },
  { value: Role.PARTS_STAFF, label: "Parts Staff" },
  { value: Role.ADMIN, label: "Admin" },
];

const schema = z.object({
  jobTitle: z.string().trim().min(1, "Tell us what your role is"),
  roles: z
    .array(z.enum(Object.values(Role) as [Role, ...Role[]]))
    .min(1, "Pick at least one access level"),
  kpis: z.string(),
  bottlenecks: z.string(),
});

export function OnboardingForm() {
  const form = useForm({
    defaultValues: {
      jobTitle: "",
      roles: [] as Role[],
      kpis: "",
      bottlenecks: "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      // On success the server action redirects to /dashboard; it only returns a
      // result here when validation fails.
      const res = await completeProfile({
        jobTitle: value.jobTitle,
        roles: value.roles,
        kpis: value.kpis,
        bottlenecks: value.bottlenecks,
      });
      if (res && !res.ok) {
        toast.error(res.error ?? "Could not save profile");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <form.Field name="jobTitle">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Your role</Label>
            <Input
              id={field.name}
              name={field.name}
              placeholder="e.g. Lead mechanic, Front desk, Service writer"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Describe what you do in your own words — this is what teammates see.
            </p>
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-xs text-destructive">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="roles">
        {(field) => (
          <div className="space-y-2">
            <Label>Access level</Label>
            <p className="text-xs text-muted-foreground">
              Pick the one(s) that match your responsibilities — controls what you can edit.
            </p>
            <div className="flex flex-col gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const checked = field.state.value.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(isChecked) => {
                        const next = isChecked
                          ? [...field.state.value, opt.value]
                          : field.state.value.filter((r) => r !== opt.value);
                        field.handleChange(next);
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-xs text-destructive">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="kpis">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Your KPIs</Label>
            <Textarea
              id={field.name}
              name={field.name}
              placeholder="What metrics define success in your role?"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="bottlenecks">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Current bottlenecks</Label>
            <Textarea
              id={field.name}
              name={field.name}
              placeholder="What slows you down day to day?"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Saving..." : "Complete profile"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
