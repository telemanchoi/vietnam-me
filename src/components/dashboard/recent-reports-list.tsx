import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RecentReport {
  id: string;
  title: string;
  status: string;
  reportType: string;
  createdAt: string;
  plan: { id: string; nameVi: string } | null;
  organization: { nameVi: string } | null;
  _count: { items: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  RETURNED: "bg-red-100 text-red-700",
};

interface RecentReportsListProps {
  reports: RecentReport[];
  title: string;
  locale: string;
}

export function RecentReportsList({ reports, title, locale }: RecentReportsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Chưa có báo cáo nào
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/${locale}/reports/${report.id}`}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{report.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {report.plan?.nameVi ?? "—"}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-xs ${STATUS_COLORS[report.status] ?? ""}`}
                >
                  {report.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
