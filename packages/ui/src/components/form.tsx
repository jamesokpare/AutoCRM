"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Form as FormPrimitive } from "@base-ui/react/form";
import { cn } from "@crm-tool/ui/lib/utils";

/**
 * Form primitives built on Base UI's Form/Field.
 *
 * These are intentionally framework-agnostic markup helpers — this app drives
 * form state with `@tanstack/react-form` (see sign-up-form.tsx). Use these for
 * consistent label/description/error layout; wire values via the field render
 * props from TanStack Form.
 */

function Form({ className, ...props }: FormPrimitive.Props) {
  return <FormPrimitive data-slot="form" className={cn("space-y-4", className)} {...props} />;
}

function FormField({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="form-field"
      className={cn("group/field flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function FormLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="form-label"
      className={cn(
        "flex items-center gap-2 text-xs leading-none select-none group-data-[disabled]/field:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function FormControl({ ...props }: FieldPrimitive.Control.Props) {
  return <FieldPrimitive.Control data-slot="form-control" {...props} />;
}

function FormDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="form-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function FormError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="form-error"
      className={cn("text-xs text-destructive", className)}
      {...props}
    />
  );
}

/**
 * Plain message slot (not tied to Base UI Field validity) — handy for
 * displaying TanStack Form field errors.
 */
function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="form-message" className={cn("text-xs text-destructive", className)} {...props} />
  );
}

export {
  Form,
  FormField,
  FormLabel,
  FormControl,
  FormDescription,
  FormError,
  FormMessage,
};
