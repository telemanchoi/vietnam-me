"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatusData {
  status: string;
  count: number;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "D\u1ef1 th\u1ea3o",
  SUBMITTED: "\u0110\u00e3 g\u1eedi",
  UNDER_REVIEW: "\u0110ang xem x\u00e9t",
  APPROVED: "\u0110\u00e3 ph\u00ea duy\u1ec7t",
  RETURNED: "Tr\u1ea3 l\u1ea1i",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#9ca3af",
  SUBMITTED: "#3b82f6",
  UNDER_REVIEW: "#eab308",
  APPROVED: "#22c55e",
  RETURNED: "#ef4444",
};

interface ReportsByStatusChartProps {
  data: StatusData[];
  title: string;
}

export function ReportsByStatusChart({ data, title }: ReportsByStatusChartProps) {
  const chartData = data.map((d) => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    status: d.status,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={STATUS_COLORS[entry.status] || "#8884d8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
