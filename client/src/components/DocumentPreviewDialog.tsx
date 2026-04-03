import { useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

interface Props {
  html: string | null;
  title?: string;
  onClose: () => void;
}

export function DocumentPreviewDialog({ html, title = "Document Preview", onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <Dialog open={!!html} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden flex flex-col bg-gray-100"
        style={{ height: "92vh" }}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">Document preview</DialogDescription>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-blue-500 hover:bg-blue-700 text-white h-8 text-xs px-3"
            >
              <Icon icon={Printer} size={14} className="mr-1.5" />
              Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClose}>
              <Icon icon={X} size={16} />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4">
          <iframe
            ref={iframeRef}
            srcDoc={html ?? undefined}
            title="document-preview"
            className="w-full h-full border-0 rounded"
            style={{ minHeight: "calc(92vh - 56px)" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
