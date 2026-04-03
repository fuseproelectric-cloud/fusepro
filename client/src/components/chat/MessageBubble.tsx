import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

export type ChatMsgItem = {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  userName: string;
  userRole: string;
};

export function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-blue-500",
  dispatcher: "bg-purple-500",
  technician: "bg-blue-500",
};

export const ROLE_LABELS: Record<string, string> = {
  admin:      "Admin",
  dispatcher: "Dispatcher",
  technician: "Tech",
};

export function formatMsgTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

export function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

export function shouldShowDateSeparator(prev: ChatMsgItem | undefined, curr: ChatMsgItem) {
  if (!prev) return true;
  return new Date(prev.createdAt).toDateString() !== new Date(curr.createdAt).toDateString();
}

export function isGroupedWithPrev(msgs: ChatMsgItem[], i: number) {
  const prev = msgs[i - 1];
  const curr = msgs[i];
  if (!prev || shouldShowDateSeparator(prev, curr)) return false;
  return prev.userId === curr.userId &&
    new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
}

export function isGroupedWithNext(msgs: ChatMsgItem[], i: number) {
  const curr = msgs[i];
  const next = msgs[i + 1];
  if (!next || shouldShowDateSeparator(curr, next)) return false;
  return curr.userId === next.userId &&
    new Date(next.createdAt).getTime() - new Date(curr.createdAt).getTime() < 5 * 60 * 1000;
}

interface Props {
  msg: ChatMsgItem;
  isOwn: boolean;
  groupedWithPrev: boolean;
  groupedWithNext: boolean;
}

export function MessageBubble({ msg, isOwn, groupedWithPrev, groupedWithNext }: Props) {
  return (
    <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row", groupedWithPrev ? "mt-0.5" : "mt-3")}>
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 flex-shrink-0 flex items-end self-end">
          {!groupedWithNext && (
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold", ROLE_COLORS[msg.userRole] ?? "bg-muted-foreground/40")}>
              {getInitials(msg.userName)}
            </div>
          )}
        </div>
      )}

      <div className={cn("flex flex-col max-w-[72%]", isOwn ? "items-end" : "items-start")}>
        {/* Name + role badge */}
        {!isOwn && !groupedWithPrev && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-xs font-semibold text-foreground">{msg.userName}</span>
            <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white", ROLE_COLORS[msg.userRole] ?? "bg-muted-foreground/40")}>
              {ROLE_LABELS[msg.userRole] ?? msg.userRole}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isOwn
            ? "bg-blue-500 text-white rounded-2xl rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-2xl rounded-bl-sm shadow-sm"
        )}>
          {msg.content}
        </div>

        {/* Timestamp */}
        {!groupedWithNext && (
          <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
            {formatMsgTime(msg.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}

export function DateSeparator({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-muted/40" />
      <span className="text-xs text-muted-foreground font-medium px-2">{formatDateSeparator(iso)}</span>
      <div className="flex-1 h-px bg-muted/40" />
    </div>
  );
}
