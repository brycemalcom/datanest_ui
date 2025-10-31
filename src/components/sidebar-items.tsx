import {
  BarChart3,
  BookOpen,
  CreditCard,
  KeyRound,
  LifeBuoy,
  SquareChartGantt,
} from "lucide-react";

export const sidebarItems = [
  {
    label: "Dashboard",
    icon: SquareChartGantt,
    active: true,
  },
  {
    label: "View Past Reports",
    icon: BookOpen,
  },
  {
    label: "Usage & Billing",
    icon: CreditCard,
  },
  {
    label: "Build Your Own Endpoint",
    icon: BarChart3,
  },
  {
    label: "API Keys & Access",
    icon: KeyRound,
  },
  {
    label: "Support / Documentation",
    icon: LifeBuoy,
  },
] as const;

