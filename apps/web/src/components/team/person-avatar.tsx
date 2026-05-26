import { Avatar, AvatarFallback, AvatarImage } from "@crm-tool/ui/components/avatar";
import { cn } from "@crm-tool/ui/lib/utils";

export interface PersonLike {
  name: string;
  photo?: string | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Small reusable avatar for team members (board, reviews, stats). */
export function PersonAvatar({
  person,
  className,
}: {
  person: PersonLike;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-6 text-[10px]", className)}>
      {person.photo ? <AvatarImage src={person.photo} alt={person.name} /> : null}
      <AvatarFallback>{initials(person.name) || "?"}</AvatarFallback>
    </Avatar>
  );
}
