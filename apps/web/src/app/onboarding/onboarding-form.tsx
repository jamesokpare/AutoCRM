"use client";

import { Role } from "@crm-tool/db/enums";
import { Button } from "@crm-tool/ui/components/button";
import { Checkbox } from "@crm-tool/ui/components/checkbox";
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
  roles: z.array(z.enum(Object.values(Role) as [Role, ...Role[]])).min(1, "Select at least one role"),
  kpis: z.string(),
  bottlenecks: z.string(),
});

export function OnboardingForm() {
  const form = useForm({
    defaultValues: {
      roles: [] as Role[],
      kpis: "",
      bottlenecks: "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      // On success the server action redirects to /dashboard; it only returns a
      // result here when validation fails.
      const res = await completeProfile({
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
      <form.Field name="roles">
        {(field) => (
          <div className="space-y-2">
            <Label>Role(s)</Label>
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
