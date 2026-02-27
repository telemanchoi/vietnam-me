import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TargetStat {
  type: string;
  count: number;
}

const TYPE_LABELS: Record<string, string> = {
  QUANTITATIVE: "\u0110\u1ecbnh l\u01b0\u1ee3ng",
  QUALITATIVE: "\u0110\u1ecbnh t\u00ednh",
  MILESTONE: "M\u1ed1c quan tr\u1ecdng",
};

const TYPE_COLORS: Record<string, string> = {
  QUANTITATIVE: "bg-blue-100 text-blue-700",
  QUALITATIVE: "bg-green-100 text-green-700",
  MILESTONE: "bg-orange-100 text-orange-700",
};

interface KpiTableProps {
  targetStats: TargetStat[];
  totalTargets: number;
  title: string;
}

export function KpiTable({ targetStats, totalTargets, title }: KpiTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {targetStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ch\u01b0a c\u00f3 ch\u1ec9 ti\u00eau n\u00e0o
          </p>
        ) : (
          <div className="space-y-3">
            {targetStats.map((stat) => (
              <div key={stat.type} className="flex items-center justify-between">
                <Badge variant="outline" className={TYPE_COLORS[stat.type] ?? ""}>
                  {TYPE_LABELS[stat.type] || stat.type}
                </Badge>
                <span className="text-sm font-mono font-medium tabular-nums">
                  {stat.count.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-sm font-medium">T\u1ed5ng c\u1ed9ng</span>
              <span className="text-sm font-mono font-bold tabular-nums">
                {totalTargets.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
