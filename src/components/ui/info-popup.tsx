import * as React from "react"
import { HelpCircle } from "lucide-react"

interface InfoPopupProps {
  title?: string;
  children: React.ReactNode;
}

export function InfoPopup({ title = "Information", children }: InfoPopupProps) {
  return (
    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
  )
}