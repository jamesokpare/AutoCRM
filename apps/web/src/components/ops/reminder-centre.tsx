"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@crm-tool/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";

import { fetchReminderCentre } from "@/lib/actions/reminders";
import type { ReminderCentre } from "@/lib/queries/reminders";
import type { ReminderTargets } from "@/lib/queries/reminders";

import { ReminderForm } from "./reminder-form";
import { ReminderList } from "./reminder-list";

export function ReminderCentreView({
  initialMine,
  initialTeam,
  targets,
}: {
  initialMine: ReminderCentre;
  initialTeam: ReminderCentre;
  targets: ReminderTargets;
}) {
  const mine = useQuery({
    queryKey: ["reminders", "mine"],
    queryFn: () => fetchReminderCentre("mine"),
    initialData: initialMine,
  });
  const team = useQuery({
    queryKey: ["reminders", "team"],
    queryFn: () => fetchReminderCentre("team"),
    initialData: initialTeam,
  });

  function refetchAll() {
    mine.refetch();
    team.refetch();
  }

  const mineCount =
    mine.data.overdue.length + mine.data.today.length + mine.data.upcoming.length;
  const teamCount =
    team.data.overdue.length + team.data.today.length + team.data.upcoming.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Reminders</h1>
          <p className="text-xs text-muted-foreground">
            Due-today, overdue and upcoming — computed in WAT on load.
          </p>
        </div>
        <ReminderForm targets={targets} onCreated={refetchAll} />
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTab value="mine">Assigned to me ({mineCount})</TabsTab>
          <TabsTab value="team">Team-wide ({teamCount})</TabsTab>
        </TabsList>
        <TabsPanel value="mine" className="pt-2">
          <ReminderList centre={mine.data} onChanged={refetchAll} />
        </TabsPanel>
        <TabsPanel value="team" className="pt-2">
          <ReminderList centre={team.data} onChanged={refetchAll} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
