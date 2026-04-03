import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageCircle, Search } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { getInitials, ROLE_COLORS, ROLE_LABELS } from "./MessageBubble";

type AppUser = { id: number; name: string; role: string; email: string };

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: number;
  onCreateDirect: (userId: number) => void;
  onCreateGroup: (name: string, memberIds: number[]) => void;
}

export function NewConversationDialog({ open, onClose, currentUserId, onCreateDirect, onCreateGroup }: Props) {
  const [mode, setMode] = useState<"choose" | "direct" | "group">("choose");
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users/list"],
    queryFn: () => apiRequest("GET", "/api/users/list").then(r => r.json()),
    enabled: open,
  });

  const others = users.filter(u => u.id !== currentUserId);
  const filtered = search ? others.filter(u => u.name.toLowerCase().includes(search.toLowerCase())) : others;

  function reset() {
    setMode("choose"); setSearch(""); setGroupName(""); setSelected([]);
  }

  function handleClose() {
    reset(); onClose();
  }

  function toggleSelect(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm bg-card">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose" ? "New Message" : mode === "direct" ? "Direct Message" : "New Group"}
          </DialogTitle>
        </DialogHeader>

        {mode === "choose" && (
          <div className="space-y-2 py-2">
            <button
              onClick={() => setMode("direct")}
              className="flex w-full items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 text-left transition"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Icon icon={MessageCircle} size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Direct Message</p>
                <p className="text-xs text-muted-foreground">Private 1-on-1 chat</p>
              </div>
            </button>
            <button
              onClick={() => setMode("group")}
              className="flex w-full items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 text-left transition"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Icon icon={Users} size={16} className="text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-semibold">Group Chat</p>
                <p className="text-xs text-muted-foreground">Chat with multiple people</p>
              </div>
            </button>
          </div>
        )}

        {(mode === "direct" || mode === "group") && (
          <div className="space-y-3 py-1">
            {mode === "group" && (
              <Input
                placeholder="Group name..."
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                autoFocus
              />
            )}
            <div className="relative">
              <Icon icon={Search} size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search people..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
                autoFocus={mode === "direct"}
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {filtered.map(u => {
                const sel = selected.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (mode === "direct") {
                        onCreateDirect(u.id);
                        handleClose();
                      } else {
                        toggleSelect(u.id);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left transition",
                      sel ? "bg-blue-50" : "hover:bg-muted/30"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", ROLE_COLORS[u.role] ?? "bg-muted-foreground/40")}>
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{ROLE_LABELS[u.role] ?? u.role}</p>
                    </div>
                    {mode === "group" && sel && (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[9px]">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              )}
            </div>
            {mode === "group" && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setMode("choose")}>Back</Button>
                <Button
                  className="flex-1 bg-blue-500 hover:bg-blue-700 text-white"
                  disabled={!groupName.trim() || selected.length === 0}
                  onClick={() => { onCreateGroup(groupName.trim(), selected); handleClose(); }}
                >
                  Create Group
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
