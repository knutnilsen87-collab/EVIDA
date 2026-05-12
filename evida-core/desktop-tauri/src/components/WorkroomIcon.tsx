import {
  AlertTriangle,
  Clock,
  Download,
  FilePenLine,
  Files,
  Gavel,
  GitCompare,
  LayoutDashboard,
  MessageSquare,
  Scale,
  ShieldCheck,
  Table,
  type LucideIcon
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  clock: Clock,
  download: Download,
  "file-pen": FilePenLine,
  files: Files,
  gavel: Gavel,
  "git-compare": GitCompare,
  "layout-dashboard": LayoutDashboard,
  "message-square": MessageSquare,
  scale: Scale,
  "shield-check": ShieldCheck,
  table: Table
};

export function WorkroomIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = icons[name] || LayoutDashboard;
  return <Icon size={size} aria-hidden="true" />;
}
