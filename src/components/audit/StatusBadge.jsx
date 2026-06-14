import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/core/referentiel";
import { classesFor } from "@/lib/audit-ui";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }) {
  const meta = STATUS_META[status];
  if (!meta) return null;
  const c = classesFor(status, STATUS_META);
  return <Badge className={cn(c.badge, className)}>{meta.label}</Badge>;
}
