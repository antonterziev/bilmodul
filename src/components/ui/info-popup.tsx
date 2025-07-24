import * as React from "react"
import { HelpCircle } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface InfoPopupProps {
  title?: string;
  children: React.ReactNode;
}

export function InfoPopup({ title = "Information", children }: InfoPopupProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-transparent">
          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">{title}</h4>
          <div className="text-sm text-muted-foreground">
            {children}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}