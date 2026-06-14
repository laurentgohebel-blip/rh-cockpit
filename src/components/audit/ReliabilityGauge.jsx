import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ReliabilityGauge({ value, nonConcluants = 0 }) {
  const tone = value >= 80 ? "bg-success" : value >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Fiabilité des données</span>
        <span className="text-xl font-semibold text-foreground">{value}%</span>
      </div>
      <Progress value={value} indicatorClassName={cn(tone)} />
      <p className="text-xs text-muted-foreground">
        {nonConcluants > 0
          ? `${nonConcluants} critère${nonConcluants > 1 ? "s" : ""} non concluant${nonConcluants > 1 ? "s" : ""} (donnée source insuffisante).`
          : "Tous les indicateurs sont calculables sur ce jeu de données."}
      </p>
    </div>
  );
}
