import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  Send, Loader2, MessageSquare, Users, Plus, ArrowLeft,
  Briefcase, ChevronDown, ChevronRight, ExternalLink,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageBubble, DateSeparator, ChatMsgItem,
  shouldShowDateSeparator, isGroupedWithPrev, isGroupedWithNext,
  getInitials, ROLE_COLORS,
} from "@/components/chat/MessageBubble";
import { NewConversationDialog } from "@/components/chat/NewConversationDialog";

type ConvListItem = {
  id: number; type: string; name: string | null; jobId: number | null;
  lastMessage: string | null; lastMessageAt: string | null;
  unreadCount: number; memberCount: number;
  members: Array<{ id: number; name: string; role: string }>;
};

type JobChatItem = {
  jobId: number; title: string; status: string;
  lastMessage: string | null; lastMessageAt: string | null; unreadCount: number;
};

// Job note shape from /api/jobs/:id/notes
type JobNote = {
  id: number; content: string; createdAt: string;
  userId: number;
  user?: { id: number; name: string; role?: string } | null;
};

function convDisplayName(conv: ConvListItem, currentUserId: number): string {
  if (conv.type === "team") return "Team Chat";
  if (conv.name) return conv.name;
  if (conv.type === "direct") {
    const other = conv.members.find(m => m.id !== currentUserId);
    return other?.name ?? "Direct Message";
  }
  return `Chat #${conv.id}`;
}

function convIcon(conv: ConvListItem, currentUserId: number) {
  if (conv.type === "team") return <Icon icon={MessageSquare} size={16} className="text-muted-foreground" />;
  if (conv.type === "direct") {
    const other = conv.members.find(m => m.id !== currentUserId);
    return (
      <div className={cn("w-full h-full rounded-full flex items-center justify-center text-white text-[10px] font-bold", ROLE_COLORS[other?.role ?? ""] ?? "bg-muted-foreground/40")}>
        {getInitials(other?.name ?? "?")}
      </div>
    );
  }
  if (conv.type === "job") return <Icon icon={Briefcase} size={16} className="text-muted-foreground" />;
  return <Icon icon={Users} size={16} className="text-muted-foreground" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-green-500", on_the_way: "bg-blue-400",
  assigned: "bg-yellow-400", completed: "bg-muted/60",
};

// ─── Job Chat View ────────────────────────────────────────────────────────────
function JobChatView({ jobId, currentUserId, onBack }: { jobId: number; currentUserId: number; onBack: () => void }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);

  const { data: jobData } = useQuery<{ title: string; status: string }>({
    queryKey: [`/api/jobs/${jobId}`],
  });

  function markRead(lastId: number) {
    qc.setQueryData<JobChatItem[]>(["/api/conversations/job-list"], prev =>
      prev?.map(j => j.jobId === jobId ? { ...j, unreadCount: 0 } : j) ?? prev
    );
    apiRequest("PUT", `/api/jobs/${jobId}/notes/read`, { lastNoteId: lastId }).catch(err => {
      console.error("markRead (job notes) failed:", err);
      qc.invalidateQueries({ queryKey: ["/api/conversations/job-list"] });
    });
  }

  useEffect(() => {
    initialLoad.current = true;
    apiRequest("GET", `/api/jobs/${jobId}/notes`)
      .then(r => r.json())
      .then((data: JobNote[]) => {
        const asc = data.slice().reverse(); // API returns desc, we want asc
        setNotes(asc);
        if (asc.length > 0) markRead(asc[asc.length - 1].id);
      });
  }, [jobId]);

  // Socket for real-time job notes
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join:job", jobId);
    const noteHandler = (note: JobNote) => {
      setNotes(prev => {
        if (prev.find(n => n.id === note.id)) return prev;
        const next = [...prev, note];
        markRead(note.id);
        return next;
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    socket.on("job:note", noteHandler);
    return () => { socket.off("job:note", noteHandler); };
  }, [jobId]);

  useEffect(() => {
    if (initialLoad.current && notes.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      initialLoad.current = false;
    }
  }, [notes]);

  async function handleSend() {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await apiRequest("POST", `/api/jobs/${jobId}/notes`, { content: text });
      setContent("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast({ title: "Failed to send message", description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  // Convert job notes to ChatMsgItem format
  const msgs: ChatMsgItem[] = notes.map(n => ({
    id: n.id,
    userId: n.userId ?? n.user?.id ?? 0,
    content: n.content,
    createdAt: n.createdAt,
    userName: n.user?.name ?? "Unknown",
    userRole: (n.user as any)?.role ?? "technician",
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <button onClick={onBack} className="lg:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground">
          <Icon icon={ArrowLeft} size={16} />
        </button>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Icon icon={Briefcase} size={16} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{jobData?.title ?? `Job #${jobId}`}</p>
          <p className="text-xs text-muted-foreground capitalize">{jobData?.status?.replace(/_/g, " ")}</p>
        </div>
        <button
          onClick={() => navigate(`/job/${jobId}`)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40"
          title="Open job detail"
        >
          <Icon icon={ExternalLink} size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <Icon icon={Briefcase} size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet for this job</p>
          </div>
        )}
        {msgs.map((msg, i) => {
          const showDate = shouldShowDateSeparator(msgs[i - 1], msg);
          return (
            <div key={msg.id}>
              {showDate && <DateSeparator iso={msg.createdAt} />}
              <MessageBubble
                msg={msg}
                isOwn={msg.userId === currentUserId}
                groupedWithPrev={isGroupedWithPrev(msgs, i)}
                groupedWithNext={isGroupedWithNext(msgs, i)}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-card px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message... (Enter to send)"
            rows={1}
            className="flex-1 resize-none min-h-[40px] max-h-32 text-sm py-2 rounded-xl"
          />
          <Button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            size="icon"
            className="h-9 w-9 rounded-full bg-blue-500 hover:bg-blue-700 flex-shrink-0 mb-0.5"
          >
            {sending ? <Icon icon={Loader2} size={16} className="animate-spin" /> : <Icon icon={Send} size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation View ────────────────────────────────────────────────────────
function ConversationView({ convId, currentUserId, onBack }: { convId: number; currentUserId: number; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMsgItem[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);
  const convIdRef = useRef(convId);

  const { data: conversations = [] } = useQuery<ConvListItem[]>({ queryKey: ["/api/conversations"] });
  const conv = conversations.find(c => c.id === convId);

  function markRead(lastId: number) {
    qc.setQueryData<ConvListItem[]>(["/api/conversations"], prev =>
      prev?.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c) ?? prev
    );
    apiRequest("PUT", `/api/conversations/${convId}/read`, { lastId }).catch(err => {
      console.error("markRead (conversation) failed:", err);
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
    });
  }

  useEffect(() => {
    convIdRef.current = convId;
    initialLoad.current = true;
    setMessages([]);
    setHasMore(true);
    apiRequest("GET", `/api/conversations/${convId}/messages`)
      .then(r => r.json())
      .then((msgs: ChatMsgItem[]) => {
        if (convIdRef.current !== convId) return;
        setMessages(msgs);
        setHasMore(msgs.length >= 60);
        if (msgs.length > 0) markRead(msgs[msgs.length - 1].id);
      });
  }, [convId]);

  useEffect(() => {
    if (initialLoad.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      initialLoad.current = false;
    }
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join:conv", convId);
    const msgHandler = (msg: ChatMsgItem & { conversationId?: number }) => {
      if (msg.conversationId !== undefined && msg.conversationId !== convId) return;
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      markRead(msg.id);
      const list = listRef.current;
      const nearBottom = list ? list.scrollHeight - list.scrollTop - list.clientHeight < 120 : true;
      if (nearBottom || msg.userId === currentUserId)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    socket.on("conv:message", msgHandler);
    return () => { socket.emit("leave:conv", convId); socket.off("conv:message", msgHandler); };
  }, [convId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const firstId = messages[0].id;
    const list = listRef.current;
    const prevHeight = list?.scrollHeight ?? 0;
    const res = await apiRequest("GET", `/api/conversations/${convId}/messages?before=${firstId}`);
    const older: ChatMsgItem[] = await res.json();
    setMessages(prev => [...older, ...prev]);
    setHasMore(older.length >= 60);
    setLoadingMore(false);
    requestAnimationFrame(() => { if (list) list.scrollTop = list.scrollHeight - prevHeight; });
  }, [loadingMore, hasMore, messages, convId]);

  async function handleSend() {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await apiRequest("POST", `/api/conversations/${convId}/messages`, { content: text });
      setContent("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast({ title: "Failed to send message", description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const convName = conv ? convDisplayName(conv, currentUserId) : "Chat";
  const subLabel = conv?.type === "team" ? "All team members" :
    conv?.type === "direct" ? "Direct message" :
    conv ? `${conv.memberCount} members` : "";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <button onClick={onBack} className="lg:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground">
          <Icon icon={ArrowLeft} size={16} />
        </button>
        <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {conv && convIcon(conv, currentUserId)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{convName}</p>
          {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3"
        onScroll={() => { if (listRef.current && listRef.current.scrollTop < 80) loadMore(); }}>
        {loadingMore && <div className="flex justify-center py-2"><Icon icon={Loader2} size={16} className="animate-spin text-muted-foreground" /></div>}
        {!hasMore && messages.length > 0 && <p className="text-center text-xs text-muted-foreground py-2">Beginning of conversation</p>}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <Icon icon={MessageSquare} size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet. Say hi!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const showDate = shouldShowDateSeparator(messages[i - 1], msg);
          return (
            <div key={msg.id}>
              {showDate && <DateSeparator iso={msg.createdAt} />}
              <MessageBubble msg={msg} isOwn={msg.userId === currentUserId}
                groupedWithPrev={isGroupedWithPrev(messages, i)}
                groupedWithNext={isGroupedWithNext(messages, i)} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-card px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea value={content} onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message... (Enter to send)" rows={1}
            className="flex-1 resize-none min-h-[40px] max-h-32 text-sm py-2 rounded-xl" />
          <Button onClick={handleSend} disabled={!content.trim() || sending} size="icon"
            className="h-9 w-9 rounded-full bg-blue-500 hover:bg-blue-700 flex-shrink-0 mb-0.5">
            {sending ? <Icon icon={Loader2} size={16} className="animate-spin" /> : <Icon icon={Send} size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation List ────────────────────────────────────────────────────────
function ConversationList({ conversations, jobChats, activeKey, currentUserId, onSelectConv, onSelectJob, onNew }: {
  conversations: ConvListItem[]; jobChats: JobChatItem[];
  activeKey: string | null; currentUserId: number;
  onSelectConv: (id: number) => void; onSelectJob: (id: number) => void; onNew: () => void;
}) {
  const [jobsOpen, setJobsOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const team = conversations.find(c => c.type === "team");
  const groups = conversations.filter(c => c.type === "group");
  const dms = conversations.filter(c => c.type === "direct");

  function ConvRow({ conv }: { conv: ConvListItem }) {
    const name = convDisplayName(conv, currentUserId);
    const active = `conv-${conv.id}` === activeKey;
    return (
      <button onClick={() => onSelectConv(conv.id)} className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-left transition",
        active ? "bg-blue-500 text-white" : "hover:bg-muted/40"
      )}>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden text-muted-foreground", active ? "bg-card/20 text-white" : "bg-muted/40")}>
          {convIcon(conv, currentUserId)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={cn("text-sm font-medium truncate", active ? "text-white" : "text-foreground")}>{name}</p>
            {conv.lastMessageAt && <span className={cn("text-[10px] flex-shrink-0", active ? "text-white/70" : "text-muted-foreground")}>{timeAgo(conv.lastMessageAt)}</span>}
          </div>
          {conv.lastMessage && <p className={cn("text-xs truncate", active ? "text-white/80" : "text-muted-foreground")}>{conv.lastMessage}</p>}
        </div>
        {conv.unreadCount > 0 && !active && (
          <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 flex-shrink-0">
            {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
          </span>
        )}
      </button>
    );
  }

  function JobRow({ job }: { job: JobChatItem }) {
    const active = `job-${job.jobId}` === activeKey;
    return (
      <button onClick={() => onSelectJob(job.jobId)} className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-left transition",
        active ? "bg-blue-500 text-white" : "hover:bg-muted/40"
      )}>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative", active ? "bg-card/20" : "bg-blue-50")}>
          <Icon icon={Briefcase} size={16} className={cn(active ? "text-white" : "text-blue-500")} />
          <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card", STATUS_DOT[job.status] ?? "bg-muted/60")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={cn("text-sm font-medium truncate", active ? "text-white" : "text-foreground")}>{job.title}</p>
            {job.lastMessageAt && <span className={cn("text-[10px] flex-shrink-0", active ? "text-white/70" : "text-muted-foreground")}>{timeAgo(job.lastMessageAt)}</span>}
          </div>
          {job.lastMessage && <p className={cn("text-xs truncate", active ? "text-white/80" : "text-muted-foreground")}>{job.lastMessage}</p>}
        </div>
        {job.unreadCount > 0 && !active && (
          <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 flex-shrink-0">
            {job.unreadCount > 99 ? "99+" : job.unreadCount}
          </span>
        )}
      </button>
    );
  }

  function Section({ label, open, onToggle, children, extra }: {
    label: string; open: boolean; onToggle: () => void; children: React.ReactNode; extra?: React.ReactNode;
  }) {
    return (
      <div>
        <div className="flex items-center justify-between px-1 mb-1">
          <button onClick={onToggle} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground">
            {open ? <Icon icon={ChevronDown} size={12} /> : <Icon icon={ChevronRight} size={12} />}
            {label}
          </button>
          {extra}
        </div>
        {open && children}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-bold text-foreground">Messages</h2>
        <button onClick={onNew} className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-700 transition">
          <Icon icon={Plus} size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {team && <ConvRow conv={team} />}

        {jobChats.length > 0 && (
          <Section label={`Job Chats (${jobChats.length})`} open={jobsOpen} onToggle={() => setJobsOpen(o => !o)}>
            {jobChats.map(j => <JobRow key={j.jobId} job={j} />)}
          </Section>
        )}

        <Section label="Groups" open={groupsOpen} onToggle={() => setGroupsOpen(o => !o)}
          extra={<button onClick={onNew} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">+ New</button>}>
          {groups.length === 0
            ? <p className="text-xs text-muted-foreground px-3 py-2">No groups yet</p>
            : groups.map(c => <ConvRow key={c.id} conv={c} />)}
        </Section>

        <Section label="Direct Messages" open={dmsOpen} onToggle={() => setDmsOpen(o => !o)}
          extra={<button onClick={onNew} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">+ New</button>}>
          {dms.length === 0
            ? <p className="text-xs text-muted-foreground px-3 py-2">No direct messages</p>
            : dms.map(c => <ConvRow key={c.id} conv={c} />)}
        </Section>
      </div>
    </div>
  );
}

// ─── Main ChatPage ────────────────────────────────────────────────────────────
export function ChatPage() {
  const { user } = useAuth();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(true);

  // Parse route: "job-5" or "1"
  const rawId = params.id ?? "";
  const isJob = rawId.startsWith("job-");
  const activeJobId = isJob ? Number(rawId.slice(4)) : null;
  const activeConvId = !isJob && rawId ? Number(rawId) : null;
  const activeKey = rawId ? (isJob ? `job-${activeJobId}` : `conv-${activeConvId}`) : null;

  // Refs so socket handlers always see the latest active IDs without reconnecting
  const activeConvIdRef = useRef(activeConvId);
  const activeJobIdRef = useRef(activeJobId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { activeJobIdRef.current = activeJobId; }, [activeJobId]);

  const { data: conversations = [], isLoading } = useQuery<ConvListItem[]>({
    queryKey: ["/api/conversations"],
    staleTime: 30_000,
    enabled: !!user,
  });

  const { data: jobChats = [] } = useQuery<JobChatItem[]>({
    queryKey: ["/api/conversations/job-list"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !!user,
  });

  // Real-time updates
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit("join:user", user.id);
    const convUnreadHandler = ({ conversationId }: { conversationId: number }) => {
      // Don't update if user currently has this conversation open
      if (conversationId === activeConvIdRef.current) return;
      // Invalidate rather than incrementing to avoid over-counting on reconnect/duplicate events
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
    };
    const convMessageHandler = (msg: ChatMsgItem & { conversationId: number }) => {
      qc.setQueryData<ConvListItem[]>(["/api/conversations"], prev =>
        prev?.map(c => c.id === msg.conversationId ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt } : c) ?? prev
      );
    };
    const jobNoteHandler = (note: { jobId?: number }) => {
      // If user has this job chat open, skip invalidation — JobChatView already called markRead
      if (note?.jobId && note.jobId === activeJobIdRef.current) return;
      qc.invalidateQueries({ queryKey: ["/api/conversations/job-list"] });
    };
    socket.on("conv:unread", convUnreadHandler);
    socket.on("conv:message", convMessageHandler);
    socket.on("job:note", jobNoteHandler);
    return () => {
      socket.off("conv:unread", convUnreadHandler);
      socket.off("conv:message", convMessageHandler);
      socket.off("job:note", jobNoteHandler);
    };
  }, [user?.id]);

  function selectConv(id: number) { navigate(`/chat/${id}`); setMobileShowList(false); }
  function selectJob(id: number) { navigate(`/chat/job-${id}`); setMobileShowList(false); }

  async function handleCreateDirect(targetUserId: number) {
    const res = await apiRequest("POST", `/api/conversations/direct/${targetUserId}`);
    const conv = await res.json();
    await qc.invalidateQueries({ queryKey: ["/api/conversations"] });
    selectConv(conv.id);
  }

  async function handleCreateGroup(name: string, memberIds: number[]) {
    const res = await apiRequest("POST", "/api/conversations", { type: "group", name, memberIds });
    const conv = await res.json();
    await qc.invalidateQueries({ queryKey: ["/api/conversations"] });
    selectConv(conv.id);
  }

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-56px)] -m-4 sm:-m-6 overflow-hidden">
      {/* Left panel */}
      <div className={cn("w-full lg:w-72 xl:w-80 flex-shrink-0 lg:flex flex-col", mobileShowList ? "flex" : "hidden")}>
        {isLoading
          ? <div className="flex items-center justify-center h-full"><Icon icon={Loader2} size={20} className="animate-spin text-muted-foreground" /></div>
          : <ConversationList
              conversations={conversations} jobChats={jobChats}
              activeKey={activeKey} currentUserId={user.id}
              onSelectConv={selectConv} onSelectJob={selectJob}
              onNew={() => setNewDialogOpen(true)} />
        }
      </div>

      {/* Right panel */}
      <div className={cn("flex-1 min-w-0 lg:flex flex-col", !mobileShowList ? "flex" : "hidden")}>
        {activeJobId != null ? (
          <JobChatView key={`job-${activeJobId}`} jobId={activeJobId} currentUserId={user.id} onBack={() => setMobileShowList(true)} />
        ) : activeConvId != null ? (
          <ConversationView key={activeConvId} convId={activeConvId} currentUserId={user.id} onBack={() => setMobileShowList(true)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Icon icon={MessageSquare} size={48} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
            <p className="text-xs text-muted-foreground mt-1">or start a new one</p>
            <Button className="mt-4 bg-blue-500 hover:bg-blue-700 text-white" onClick={() => setNewDialogOpen(true)}>
              <Icon icon={Plus} size={16} className="mr-1.5" /> New Message
            </Button>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={newDialogOpen} onClose={() => setNewDialogOpen(false)}
        currentUserId={user.id} onCreateDirect={handleCreateDirect} onCreateGroup={handleCreateGroup}
      />
    </div>
  );
}
